import { INodeProperties } from 'n8n-workflow';

export const qrOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
			},
		},
		options: [
			{
				name: 'Generate QR Code',
				value: 'generate',
				description: 'Create standalone professional QR codes (Static or Dynamic)',
				action: 'Generate a QR code',
			},
			{
				name: 'Get QR Code',
				value: 'get',
				description: 'Get details of a generated QR code',
				action: 'Get a QR code',
			},
			{
				name: 'List QR Codes',
				value: 'list',
				description: 'Get a list of all your QR codes',
				action: 'List all QR codes',
			},
			{
				name: 'Update QR Code',
				value: 'update',
				description: 'Update an existing QR code (name, content, visual settings)',
				action: 'Update a QR code',
			},
			{
				name: 'Delete QR Code',
				value: 'delete',
				description: 'Delete a generated QR code',
				action: 'Delete a QR code',
			},
		],
		default: 'generate',
		description: 'The operation to perform',
	},
];

export const qrFields: INodeProperties[] = [
	// ----- QR: Generate -----
	{
		displayName: 'Content Type',
		name: 'contentType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		options: [
			{ name: 'URL', value: 'url' },
			{ name: 'Text', value: 'text' },
			{ name: 'WiFi', value: 'wifi' },
			{ name: 'vCard', value: 'vcard' },
			{ name: 'Email', value: 'email' },
			{ name: 'SMS', value: 'sms' },
			{ name: 'Phone', value: 'phone' },
			{ name: 'WhatsApp', value: 'whatsapp' },
			{ name: 'Location', value: 'location' },
		],
		default: 'url',
		description: 'The category of content to encode in the QR code',
	},

	// URL Fields
	{
		displayName: 'URL',
		name: 'qrUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['url'],
			},
		},
		default: '',
		placeholder: 'https://example.com',
		description: 'The destination URL to encode in the QR code',
	},

	// Text Fields
	{
		displayName: 'Text',
		name: 'qrText',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['text'],
			},
		},
		default: '',
		placeholder: 'Enter text to encode',
		description: 'The custom text to encode in the QR code',
	},

	// WiFi Fields
	{
		displayName: 'Network SSID',
		name: 'wifiSsid',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['wifi'],
			},
		},
		default: '',
		placeholder: 'MyHomeWiFi',
		description: 'The WiFi network name (SSID)',
	},
	{
		displayName: 'Security Type',
		name: 'wifiSecurity',
		type: 'options',
		options: [
			{ name: 'WPA/WPA2', value: 'WPA' },
			{ name: 'WEP', value: 'WEP' },
			{ name: 'Unsecured', value: 'nopass' },
		],
		default: 'WPA',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['wifi'],
			},
		},
		description: 'The encryption protocol of the network',
	},
	{
		displayName: 'Password',
		name: 'wifiPassword',
		type: 'string',
		typeOptions: {
			password: true,
		},
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['wifi'],
			},
			hide: {
				wifiSecurity: ['nopass'],
			},
		},
		default: '',
		description: 'The WiFi network password',
	},

	// Email Fields
	{
		displayName: 'Email Recipient',
		name: 'emailRecipient',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['email'],
			},
		},
		default: '',
		placeholder: 'hello@example.com',
		description: 'The recipient email address',
	},
	{
		displayName: 'Subject',
		name: 'emailSubject',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['email'],
			},
		},
		default: '',
		placeholder: 'Inquiry from QR Code',
		description: 'The email subject line',
	},
	{
		displayName: 'Body',
		name: 'emailBody',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['email'],
			},
		},
		default: '',
		placeholder: 'Enter email body content...',
		description: 'The email body content',
	},

	// Phone Fields
	{
		displayName: 'Phone Number',
		name: 'phoneNum',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['phone'],
			},
		},
		default: '',
		placeholder: '+15550100',
		description: 'The phone number to dial (in international format)',
	},

	// SMS Fields
	{
		displayName: 'Phone Number',
		name: 'smsPhone',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['sms'],
			},
		},
		default: '',
		placeholder: '+15550100',
		description: 'The recipient phone number (in international format)',
	},
	{
		displayName: 'Message',
		name: 'smsMessage',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['sms'],
			},
		},
		default: '',
		placeholder: 'Type your message here...',
		description: 'The pre-filled SMS message text',
	},

	// WhatsApp Fields
	{
		displayName: 'Phone Number',
		name: 'whatsappPhone',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['whatsapp'],
			},
		},
		default: '',
		placeholder: '+15550100',
		description: 'The WhatsApp phone number (in international format)',
	},
	{
		displayName: 'Message',
		name: 'whatsappMessage',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['whatsapp'],
			},
		},
		default: '',
		placeholder: 'Type your message here...',
		description: 'The pre-filled WhatsApp message text',
	},

	// Location Fields
	{
		displayName: 'Latitude',
		name: 'locationLatitude',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['location'],
			},
		},
		default: '',
		placeholder: '37.7749',
		description: 'The latitude coordinates of the location',
	},
	{
		displayName: 'Longitude',
		name: 'locationLongitude',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['location'],
			},
		},
		default: '',
		placeholder: '-122.4194',
		description: 'The longitude coordinates of the location',
	},

	// vCard Fields
	{
		displayName: 'First Name',
		name: 'vcardFirstName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['vcard'],
			},
		},
		default: '',
		placeholder: 'Jane',
		description: 'First name of the contact',
	},
	{
		displayName: 'Last Name',
		name: 'vcardLastName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['vcard'],
			},
		},
		default: '',
		placeholder: 'Smith',
		description: 'Last name of the contact',
	},
	{
		displayName: 'Phone Number',
		name: 'vcardPhone',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['vcard'],
			},
		},
		default: '',
		placeholder: '+15550199',
		description: 'Mobile phone number of the contact',
	},
	{
		displayName: 'Email',
		name: 'vcardEmail',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['vcard'],
			},
		},
		default: '',
		placeholder: 'jane@company.com',
		description: 'Work email address of the contact',
	},
	{
		displayName: 'Organization',
		name: 'vcardOrg',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['vcard'],
			},
		},
		default: '',
		placeholder: 'ACME Labs',
		description: 'Company or organization of the contact',
	},
	{
		displayName: 'Title',
		name: 'vcardTitle',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['vcard'],
			},
		},
		default: '',
		placeholder: 'Design Lead',
		description: 'Job title of the contact',
	},
	{
		displayName: 'Website URL',
		name: 'vcardUrl',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				contentType: ['vcard'],
			},
		},
		default: '',
		placeholder: 'https://company.com',
		description: 'Website URL of the contact',
	},

	// General Fields
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: '',
		placeholder: 'My Website QR',
		description: 'Optional display name to help organize your QR codes',
	},
	{
		displayName: 'Is Dynamic',
		name: 'isDynamic',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: false,
		description: 'Whether to create a dynamic QR code (editable destination)',
	},
	{
		displayName: 'Tracking Enabled',
		name: 'trackingEnabled',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: false,
		description: 'Whether to enable scan tracking and analytics (only works for dynamic QR codes)',
	},
	{
		displayName: 'Campaign Name or ID',
		name: 'campaignId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getCampaigns',
		},
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: '',
		required: false,
		description: 'Optionally associate this QR code with a Campaign',
	},
	{
		displayName: 'QR Code Link Branding',
		name: 'urlType',
		type: 'options',
		options: [
			{ name: 'Standard (jmpy.me)', value: 'standard' },
			{ name: 'Branded Domain', value: 'branded' },
			{ name: 'Subdomain', value: 'subdomain' },
		],
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: 'standard',
		description: 'Choose whether the dynamic QR code short link uses a standard domain, branded domain, or subdomain',
	},
	{
		displayName: 'Branded Domain',
		name: 'brandedDomain',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getBrandedDomains',
		},
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				urlType: ['branded'],
			},
		},
		default: '',
		description: 'Select a verified branded domain',
	},
	{
		displayName: 'Subdomain',
		name: 'subdomain',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getSubdomains',
		},
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
				urlType: ['subdomain'],
			},
		},
		default: '',
		description: 'Select a verified subdomain',
	},

	// UTM Parameters
	{
		displayName: 'UTM Source',
		name: 'utmSource',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: '',
		placeholder: 'google',
		description: 'Optional. Identifies the advertiser/site. Must NOT contain spaces (use _ or - instead, e.g. "google" or "email_newsletter")',
	},
	{
		displayName: 'UTM Medium',
		name: 'utmMedium',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: '',
		placeholder: 'qr_code',
		description: 'Optional. Identifies the advertising medium. Must NOT contain spaces (use _ or - instead, e.g. "qr_code" or "cpc")',
	},
	{
		displayName: 'UTM Campaign',
		name: 'utmCampaign',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: '',
		placeholder: 'summer_sale',
		description: 'Optional. Identifies the specific campaign. Must NOT contain spaces (use _ or - instead, e.g. "summer_sale")',
	},
	{
		displayName: 'UTM Term',
		name: 'utmTerm',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: '',
		placeholder: 'discount',
		description: 'Optional. Identifies paid search keywords. Must NOT contain spaces (use _ or - instead, e.g. "discount_code")',
	},
	{
		displayName: 'UTM Content',
		name: 'utmContent',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['generate'],
			},
		},
		default: '',
		placeholder: 'hero_banner',
		description: 'Optional. Differentiates similar content or links. Must NOT contain spaces (use _ or - instead, e.g. "hero_banner")',
	},

	// ----- QR: Get Detail / Delete -----
	{
		displayName: 'QR Code ID',
		name: 'qrCodeId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['get', 'delete'],
			},
		},
		default: '',
		description: 'The unique ID of the QR code',
	},

	// ----- QR: List -----
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['list'],
			},
		},
		typeOptions: {
			minValue: 20,
			maxValue: 100,
		},
		default: 20,
		description: 'Max number of results to return per page (min: 20, max: 100)',
	},
	{
		displayName: 'Max Pages',
		name: 'page',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['list'],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 10,
		},
		default: 1,
		description: 'Maximum number of pages to fetch (max: 10). E.g. setting 5 fetches pages 1 through 5 (or stops early if no more data exists)',
	},

	// ----- QR: Update -----
	{
		displayName: 'QR Code ID',
		name: 'qrCodeId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['update'],
			},
		},
		default: '',
		description: 'The unique ID of the QR code to update',
	},
	{
		displayName: 'New Display Name',
		name: 'name',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['update'],
			},
		},
		default: '',
		placeholder: 'My Updated QR Code',
		description: 'New display name for the QR code',
	},
	{
		displayName: 'New Content Type',
		name: 'contentType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['update'],
			},
		},
		options: [
			{ name: 'URL', value: 'url' },
		],
		default: 'url',
		description: 'The category of content to encode in the QR code',
	},
	{
		displayName: 'New URL',
		name: 'qrUrl',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['update'],
				contentType: ['url'],
			},
		},
		default: '',
		placeholder: 'https://new-destination.com',
		description: 'The new destination URL to encode in the QR code',
	},
	{
		displayName: 'Tracking Enabled',
		name: 'trackingEnabled',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['qrCode'],
				operation: ['update'],
			},
		},
		default: true,
		description: 'Whether to enable scan tracking and analytics (only works for dynamic QR codes)',
	},
];

