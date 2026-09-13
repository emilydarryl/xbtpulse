import { validateProfile } from "./profiles.mjs";
export function validateApplication(body) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (!body || typeof body !== "object")
    fail("Please complete the operator form.");
  if (body.fax) fail("Unable to accept this submission.");
  const field = (key, min, max) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (value.length < min || value.length > max) fail(`Please check ${key}.`);
    return value;
  };
  const id = field("id", 36, 36);
  if (!/^[a-f0-9-]{36}$/.test(id))
    fail("Invalid request identifier. Refresh and try again.");
  const name = field("name", 2, 100),
    contact = field("contact", 3, 200);
  const software = field("software", 2, 200),
    role = field("role", 1, 40);
  if (!["own-templates", "hosted-templates", "mixed", "unsure"].includes(role))
    fail("Choose a template role.");
  const website = field("website", 0, 300),
    notes = field("notes", 0, 1500);
  if (website) {
    let url;
    try {
      url = new URL(website);
    } catch {
      fail("Use a complete public website URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail("Use an HTTPS website without credentials.");
  }
  if (body.consent !== true)
    fail("Please acknowledge how your information will be used.");
  return {
    id,
    name,
    contact,
    website,
    software,
    role,
    notes,
    profileConsent: body.profileConsent === true,
    ...(body.profileConsent === true ? { profile: validateProfile(body) } : {}),
  };
}
