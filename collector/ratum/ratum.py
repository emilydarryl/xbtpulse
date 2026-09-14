"""RATUM Prime adapter preview. Supports exact cumulative work counters.
No scraping of payout-window work or estimated hashrate is permitted.
"""
import argparse, json, math, os, re, subprocess, time, uuid, urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parent

def save(name,body):
    p=ROOT/(name+'.tmp')
    with p.open('w') as f:
        p.chmod(0o600);json.dump(body,f);f.flush();os.fsync(f.fileno())
    p.replace(ROOT/name)

def normalize(data,config,now):
    if data['pool']['version']!=config['expectedBuild'] or data['pool']['pubkey']!=config['expectedPubkey']:
        raise ValueError('Build or pool identity mismatch')
    stamp=data['generated_at']*1000
    if not isinstance(stamp,int) or abs(stamp-now)>60000: raise ValueError('Stale source clock')
    metrics=data.get('xbtpulse',{})
    source=config.get('counterSource','xbtpulse-v1')
    if source=='prime-cumulative':
        raw=data.get('cumulative_accepted_work');found=None
    elif source=='xbtpulse-v1':
        if metrics.get('schema')!=1: raise ValueError('Exact telemetry counters missing; stock stats.json is insufficient')
        raw=metrics.get('cumulative_share_difficulty');found=metrics.get('blocks_found')
    else: raise ValueError('Unknown counter source')
    if not isinstance(raw,str) or not re.fullmatch(r'[0-9]{1,39}',raw): raise ValueError('Invalid work counter')
    if int(raw)>2**128-1: raise ValueError('Work counter exceeds u128')
    network=data['network'];difficulty=network['difficulty'];height=network['tip_height']
    if (source=='xbtpulse-v1' and (type(found)is not int or found<0)) or type(height)is not int or height<961640 or network.get('chain') not in ('main','mainnet'):
        raise ValueError('Invalid chain or block counter')
    if type(difficulty) not in (int,float) or not math.isfinite(difficulty) or difficulty<=0: raise ValueError('Invalid difficulty')
    return dict(time=stamp,work=int(raw),found=found,difficulty=difficulty,height=height,build=data['pool']['version'],pool=data['pool']['pubkey'],counterSource=source)

def interval(old,new):
    if not 10000<=new['time']-old['time']<=900000: return None
    if any(old[k]!=new[k] for k in ('process','build','pool','difficulty')): return None
    if old.get('counterSource')!=new.get('counterSource'): return None
    if new['height']<old['height'] or new['height']//2016!=old['height']//2016: return None
    if new['work']<old['work']: return None
    if (old['found'] is None)!=(new['found'] is None): return None
    if new['found'] is not None and new['found']<old['found']: return None
    work=new['work']-old['work'];found=None if new['found'] is None else new['found']-old['found']
    # Keep integer counter subtraction exact through JSON/JavaScript ingestion.
    if work>2**53-1 or (found is not None and (found>10000 or (found and not work))): return None
    return dict(id=str(uuid.uuid4()),start=old['time'],end=new['time'],found=found,segments=[dict(shareDifficultySum=work,networkDifficulty=new['difficulty'])])

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError("Redirect refused")

def opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

def read_stats(config):
    url=urlparse(config['statsUrl'])
    if url.scheme not in ('http','https') or url.hostname not in ('localhost','127.0.0.1','::1') or url.username or url.password:
        raise ValueError('Use a loopback stats URL on the Prime host')
    with opener().open(config['statsUrl'],timeout=10) as response:
        return json.loads(response.read(4000000))

def process_identity(config):
    if config.get('pidFile'):
        pid=Path(config['pidFile']).read_text().strip()
    else:
        pid=subprocess.check_output(['systemctl','show',config['unit'],'-p','MainPID','--value'],text=True,timeout=10).strip()
    if not re.fullmatch(r'[1-9][0-9]*',pid): raise ValueError('Prime PID unavailable')
    start=Path('/proc/'+pid+'/stat').read_text().split(') ')[1].split()[19]
    return Path('/proc/sys/kernel/random/boot_id').read_text().strip()+':'+pid+':'+start

def snapshot(config):
    before=process_identity(config)
    sample=normalize(read_stats(config),config,int(time.time()*1000))
    after=process_identity(config)
    if before!=after: raise ValueError('Prime restarted during measurement')
    sample['process']=after
    return sample

def post(config,path,body):
    request=urllib.request.Request('https://xbtpulse.tech'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+(Path(config['tokenFile']).read_text().strip() if config.get('tokenFile') else config['token'])})
    with opener().open(request,timeout=15) as r: return json.load(r)

def run(check=False):
    import fcntl
    os.umask(0o077)
    config=json.loads((ROOT/'config.json').read_text())
    if check:
        a=snapshot(config);time.sleep(10);b=snapshot(config)
        report=interval(a,b)
        if report is None: raise ValueError('Uncertain measurement interval; retry check')
        print('Local check passed. Work delta: '+str(report['segments'][0]['shareDifficultySum'])+'; block outcomes unavailable. No upload or reporting baseline saved.');return
    with (ROOT/'lock').open('w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        state=json.loads((ROOT/'state.json').read_text()) if (ROOT/'state.json').exists() else {}
        if state.get('pending'):
            post(config,'/api/telemetry',state['pending']);state.pop('pending');save('state.json',state)
        current=snapshot(config)
        challenge=ROOT/'challenge.json'
        if challenge.exists():post(config,'/api/telemetry/challenge',json.loads(challenge.read_text()));challenge.unlink()
        report=interval(state['last'],current) if state.get('last') else None
        state['last']=current
        if report:state['pending']=report
        save('state.json',state)
        if report:post(config,'/api/telemetry',report);state.pop('pending');save('state.json',state)
        save('status.json',{'time':int(time.time()*1000),'status':'Measured interval accepted' if report else 'Baseline saved; uncertain or initial interval omitted'})

def setup(args):
    if (ROOT/'config.json').exists(): raise ValueError('config.json already exists; preserve it')
    config={'statsUrl':args.stats_url,'counterSource':'prime-cumulative'}
    if args.unit: config['unit']=args.unit
    elif args.pid_file: config['pidFile']=str(Path(args.pid_file).resolve())
    else: raise ValueError('Specify --unit or --pid-file for the Prime process')
    data=read_stats(config)
    config['expectedBuild']=data['pool']['version']
    config['expectedPubkey']=data['pool']['pubkey']
    if not all(isinstance(config[k],str) and config[k] and '<' not in config[k] for k in ('expectedBuild','expectedPubkey')):
        raise ValueError('Local stats must contain unredacted build and public identity')
    config['tokenFile']=str(ROOT/'token.txt')
    snapshot(config)
    save('config.json',config)
    print('Local identity pinned in private config.json. No token needed, no upload. Run --check next.')

def main():
    parser=argparse.ArgumentParser(description='Prime work-only adapter. Default action is a local check; uploads require --submit.')
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument('--setup',action='store_true')
    modes.add_argument('--check',action='store_true')
    modes.add_argument('--submit',action='store_true')
    parser.add_argument('--stats-url')
    process=parser.add_mutually_exclusive_group()
    process.add_argument('--unit')
    process.add_argument('--pid-file')
    args=parser.parse_args()
    os.umask(0o077)
    try:
        if args.setup:
            if not args.stats_url: raise ValueError('--stats-url is required for setup')
            setup(args)
        else: run(check=not args.submit)
    except Exception as error:
        print('Adapter stopped: '+type(error).__name__+'. Check local URL, process access, configuration and counter schema. No new measurement should be assumed delivered.')
        return 1
    return 0

if __name__=='__main__':
    raise SystemExit(main())
