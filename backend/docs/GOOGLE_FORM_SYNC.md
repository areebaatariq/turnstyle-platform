# Syncing Google Form responses to client profiles

When you send an invitation to a client, the email includes a link to an optional style questionnaire (Google Form). When the client submits the form, their answers can be automatically added to that client’s profile in the app.

## How it works

1. **Invite email** – The invitation email includes the form link. No extra setup needed for that.
2. **Form submission** – The client fills out the form and submits.
3. **Sync** – A script (e.g. Google Apps Script in the form’s spreadsheet) runs on submit and sends the response to your backend. The backend finds the client by **email** and updates their optional profile fields.

## Backend setup

### 1. Environment variables (optional but recommended)

In `.env`:

- **`FORM_WEBHOOK_SECRET`** – Shared secret for the form webhook. If set, the `/api/clients/form-response` endpoint requires this value in the `x-api-key` header. If not set, the endpoint is open (use only in development).
- **`CLIENT_STYLE_FORM_URL`** – Full URL of the style questionnaire (viewform link). Defaults to the built-in form URL if not set.

### 2. API endpoint

- **URL:** `POST /api/clients/form-response`
- **Auth:** If `FORM_WEBHOOK_SECRET` is set, send it in the header:  
  `x-api-key: YOUR_FORM_WEBHOOK_SECRET`
- **Body (JSON):** At least `email` (used to find the client). Any other fields are optional and will update the client’s profile if provided:

  - `email` (required) – Client’s email; must match an existing client.
  - `featuresYouLove`
  - `wardrobeColors`
  - `personalStyle`
  - `dailySchedule`
  - `featuresYouDislike`
  - `styleIcons`
  - `styleIconsDescription`
  - `additionalStyleInfo`
  - `instagramHandle`
  - `outfitsPerDayEstimate`
  - `weekdayOutfitDetails`

Example:

```json
{
  "email": "client@example.com",
  "featuresYouLove": "My shoulders and legs",
  "personalStyle": "Minimal and clean"
}
```

## Google Apps Script (form → API)

1. Open the **Google Form** and go to **Responses** → **Link to Sheets** (create a spreadsheet if needed).
2. In the **Spreadsheet**: **Extensions** → **Apps Script**.
3. Replace the script with the template below.
4. Set your API URL and (if you use it) API key in the config at the top.
5. Map your form question **titles** (or entry IDs) to the API field names in `FORM_TO_API`. Form titles must match exactly what you see in the form editor (or use the entry IDs from the form’s “prefill” / “get link” options).
6. Add an **onFormSubmit** trigger: **Triggers** (clock icon) → **Add Trigger** → function: `onFormSubmit` → event: **From spreadsheet** → **On form submit** → Save.

### Script template

```javascript
// ============ CONFIG ============
var API_URL = 'https://YOUR_BACKEND_URL/api/clients/form-response';  // e.g. https://yourapp.onrender.com/api/clients/form-response
var API_KEY = 'YOUR_FORM_WEBHOOK_SECRET';  // optional; leave '' if you don't use FORM_WEBHOOK_SECRET

// Map your form question TITLES (as in Form Editor) to API field names.
// Add/remove rows to match your form. API field names must be exactly: email, featuresYouLove, wardrobeColors, personalStyle, dailySchedule, featuresYouDislike, styleIcons, styleIconsDescription, additionalStyleInfo, instagramHandle, outfitsPerDayEstimate, weekdayOutfitDetails
var FORM_TO_API = {
  'Email address': 'email',
  'Which features do you love about yourself?': 'featuresYouLove',
  'What specific colors make up the bulk of your wardrobe?': 'wardrobeColors',
  'How would you describe your personal style?': 'personalStyle',
  'Briefly describe your daily schedule': 'dailySchedule',
  'Are there any features you don\'t like as much?': 'featuresYouDislike',
  'Who are your style icons?': 'styleIcons',
  'Describe your style icons': 'styleIconsDescription',
  'Is there anything else you\'d like to share regarding your style?': 'additionalStyleInfo',
  'Instagram handle': 'instagramHandle',
  'How many outfits do you wear in a given day?': 'outfitsPerDayEstimate',
  'Weekday outfits for work and/or home typically include': 'weekdayOutfitDetails'
};

// ============ SCRIPT ============
function onFormSubmit(e) {
  if (!e || !e.values) return;
  var sheet = e.source.getActiveSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = e.values;
  var payload = {};
  for (var i = 0; i < headers.length; i++) {
    var title = headers[i];
    var apiField = FORM_TO_API[title];
    if (apiField && row[i] !== undefined && String(row[i]).trim() !== '') {
      payload[apiField] = String(row[i]).trim();
    }
  }
  if (!payload.email) {
    Logger.log('No email in response – skipping sync');
    return;
  }
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  if (API_KEY) options.headers = { 'x-api-key': API_KEY };
  var response = UrlFetchApp.fetch(API_URL, options);
  Logger.log('Form sync response: ' + response.getResponseCode() + ' – ' + response.getContentText());
}
```

After saving, run `onFormSubmit` once manually (with a test form submit) and check **Executions** in Apps Script to confirm the API is called and the client is updated.

## Result

- Invite emails include the style form link.
- When a client submits the form, the script sends their answers to your backend.
- The client is matched by email and their optional profile fields are updated.
- Stylists see the new details in the Client tab (e.g. in “More about this client”).
