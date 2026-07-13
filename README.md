# n8n-nodes-jmpy

Official [n8n](https://n8n.io/) community node for [Jmpy.me](https://jmpy.me) – Shorten URLs, generate dynamic QR codes, and track advanced marketing campaigns right from your n8n workflows.

Unlock the full potential of Jmpy.me in your n8n workflows! This package provides comprehensive modules to integrate powerful branded link management and QR code generation seamlessly.

## Setup & Authentication
To use this node, you need to create an OAuth API key from your Jmpy.me account and provide it to n8n.
Go to `Settings -> API Keys` in Jmpy.me, create an App, and copy the Client ID and Secret to your n8n credentials for the `Jmpy.me OAuth2 API` connection.


---

## 📖 Usage Example

Here is a step-by-step walkthrough of how to shorten a URL in your workflow:

1. **Add the Jmpy.me node**: In the n8n canvas, click `+`, search for **Jmpy.me**, and add it.
2. **Select Credentials**: Select your configured `Jmpy.me OAuth2 API` credentials.
3. **Configure the Node**:
   - **Resource**: `URL`
   - **Operation**: `Shorten URL`
4. **Set Parameters**:
   - **Long URL**: `https://example.com`
5. **Run / Test**: Click **Test Step**. The node will output the returned short URL and metadata (e.g. `shortUrl`, `longUrl`, campaign information, etc.) to use in subsequent nodes.

---

## ⚡ Actions (Available for all plans)

Automate your URL shortening and marketing processes with these action nodes:

### 🔗 URL Management
- **Shorten URL**: Create a professional branded short URL with support for subdomains and branded domains.
- **Get URL Detail**: Retrieve details and analytics for a shortened URL.
- **List URLs**: Get a comprehensive list of all your shortened URLs.
- **Delete URL**: Remove a shortened URL from your account permanently.

### 📱 QR Code Generation
- **Generate QR Code**: Create standalone professional QR codes (Static or Dynamic) with various content types.
- **Get QR Code**: Retrieve details for a generated QR code.
- **List QR Codes**: View a list of all your generated QR codes.
- **Delete QR Code**: Delete an existing QR code.

### 🎯 Campaign Management
- **Create Campaign**: Group related URLs under a new campaign.
- **Get Campaign Detail**: Fetch details of a campaign by its ID or name.
- **List Campaigns**: Get a list of all your marketing campaigns.
- **Delete Campaign**: Remove a campaign entirely.

---

## 🕒 Triggers

We provide two sets of triggers to capture events seamlessly: **Polling Triggers** (Free) and **Instant Webhook Triggers** (Requires Business Plan).

> [!NOTE]  
> **Testing Locally or behind a Firewall?** 
> By default, if you are running n8n on your local machine (e.g., `localhost`), you **must** use the **Polling Triggers** to receive events. 
> 
> **Want to use Instant Webhook Triggers locally?** 
> Your n8n instance must be publicly accessible via a tunnel (like ngrok or `n8n start --tunnel`). If you are using a tunnel, you must ensure your n8n environment has the `WEBHOOK_URL` variable set to your public tunnel URL (e.g., `WEBHOOK_URL=https://my-tunnel.ngrok.app`). Otherwise, the n8n UI will incorrectly send `localhost` as the webhook callback to Jmpy.me.
### Polling Triggers (Free - Available to all users)
These triggers check for new events on a scheduled basis.

- **New Short URL Created**: Triggers when a new short URL is created on your account (polled).
- **New QR Code Created**: Triggers when a new QR code is generated on your account (polled).
- **New Link Click**: Triggers when any of your short URLs is clicked by a user (polled).
- **New Link Click (Unique)**: Triggers when a short URL receives a click from a unique visitor (polled).
- **New Link Click (with UTM)**: Triggers when a short URL is clicked and contains UTM parameters (polled).
- **New QR Code Scan**: Triggers when any of your QR codes is scanned (polled).
- **New QR Code Scan (Unique)**: Triggers when a QR code receives a scan from a unique visitor (polled).

### Instant Triggers (Requires Business Plan)
These triggers use webhooks to push data to n8n instantaneously, providing real-time automation.

- **New Short URL Created**: Triggers immediately the exact moment a new short URL is created.
- **Link Clicked**: Triggers immediately in real-time when any short URL is clicked.
- **Link Clicked (Unique Visitor)**: Triggers immediately when a short URL is clicked by a unique visitor (deduplicated over 24h).
- **Link Clicked (With UTM)**: Triggers immediately when a short URL with UTM tracking parameters is clicked.
- **New QR Code Created**: Triggers immediately the exact moment a new QR code is generated.
- **QR Code Scanned**: Triggers immediately in real-time when any QR code is scanned.
- **QR Code Scanned (Unique Visitor)**: Triggers immediately when a QR code is scanned by a unique visitor (deduplicated over 24h).

---

## Installation
You can install this node from the n8n community nodes panel. Search for `n8n-nodes-jmpy`.

## License
MIT License
