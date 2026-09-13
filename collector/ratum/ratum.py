"""RATUM Prime adapter preview. Requires the explicit xbtpulse metrics extension.
No scraping of payout-window work or estimated hashrate is permitted.
"""
import json, math, os, re, subprocess, time, uuid, urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parent

def save(name,body):
    p=ROOT/(name+'.tmp');p.write_text(json.dumps(body));p.chmod(0o600);p.replace(ROOT/name)

def normalize(data,config,now):
    if data['pool']['version']!=config['expectedBuild'] or data['pool']['pubkey']!=config['expectedPubkey']:
        raise ValueError('Build or pool identity mismatch')
    stamp=data['generated_at']*1000
    if not isinstance(stamp,int) or abs(stamp-now)>60000: raise ValueError('Stale source clock')
    metrics=data.get('xbtpulse',{})
    if metrics.get('schema')!=1: raise ValueError('Exact telemetry counters missing; stock stats.json is insufficient')
    raw=metrics.get('cumulative_share_difficulty')
    if not isinstance(raw,str) or not re.fullmatch(r'[0-9]{1,39}',raw): raise ValueError('Invalid work counter')
    found=metrics.get('blocks_found');network=data['network'];difficulty=network['difficulty'];height=network['tip_height']
    if type(found)is not int or found<0 or type(height)is not int or height<961640 or network.get('chain') not in ('main','mainnet'):
        raise ValueError('Invalid chain or block counter')
    if type(difficulty) not in (int,float) or not math.isfinite(difficulty) or difficulty<=0: raise ValueError('Invalid difficulty')
    return dict(time=stamp,work=int(raw),found=found,difficulty=difficulty,height=height,build=data['pool']['version'],pool=data['pool']['pubkey'])

def interval(old,new):
    if not 10000<=new['time']-old['time']<=900000: return None
    if any(old[k]!=new[k] for k in ('process','build','pool','difficulty')): return None
    if new['height']<old['height'] or new['height']//2016!=old['height']//2016: return None
    if new['work']<old['work'] or new['found']<old['found']: return None
    work=new['work']-old['work'];found=new['found']-old['found']
    if work>1e30 or found>10000 or (found and not work): return None
    return dict(id=str(uuid.uuid4()),start=old['time'],end=new['time'],found=found,segments=[dict(shareDifficultySum=work,networkDifficulty=new['difficulty'])])

def snapshot(config):
    url=urlparse(config['statsUrl'])
    if url.scheme not in ('http','https') or url.hostname not in ('localhost','127.0.0.1','::1') or url.username or url.password:
        raise ValueError('Use a loopback stats URL on the Prime host')
    with urllib.request.urlopen(config['statsUrl'],timeout=10) as response:
        sample=normalize(json.loads(response.read(4000000)),config,int(time.time()*1000))
    pid=subprocess.check_output(['systemctl','show',config['unit'],'-p','MainPID','--value'],text=True,timeout=10).strip()
    start=Path('/proc/'+pid+'/stat').read_text().split(') ')[1].split()[19]
    sample['process']=Path('/proc/sys/kernel/random/boot_id').read_text().strip()+':'+pid+':'+start
    return sample

def post(config,path,body):
    request=urllib.request.Request('https://xbtpulse.tech'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+config['token']})
    with urllib.request.urlopen(request,timeout=15) as r: return json.load(r)

def run(check=False):
    import fcntl
    os.umask(0o077)
    config=json.loads((ROOT/'config.json').read_text())
    if check:
        snapshot(config);print('Exact counter schema and local process checks passed. No upload.');return
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

if __name__=='__main__':
    import sys
    try:run('--check' in sys.argv)
    except Exception as error:
        save('status.json',{'time':int(time.time()*1000),'status':'No new report; inspect compatibility or upload failure','errorType':type(error).__name__})
        print('Collector failed: '+type(error).__name__);raise SystemExit(1)
