import { INodeProperties } from 'n8n-workflow';

export const urlOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['url'],
			},
		},
		options: [
			{
				name: 'Shorten URL',
				value: 'shorten',
				description: 'Create a professional branded short URL',
				action: 'Shorten a URL',
			},
			{
				name: 'Get URL Detail',
				value: 'get',
				description: 'Get details of a shortened URL by its short URL',
				action: 'Get a URL detail',
			},
			{
				name: 'List URLs',
				value: 'list',
				description: 'Get a list of all your short URLs',
				action: 'List all URLs',
			},
			{
				name: 'Update Short URL',
				value: 'update',
				description: 'Update an existing shortened URL',
				action: 'Update a shortened URL',
			},
			{
				name: 'Delete URL',
				value: 'delete',
				description: 'Delete a shortened URL',
				action: 'Delete a URL',
			},
		],
		default: 'shorten',
	},
];

export const urlFields: INodeProperties[] = [
	// ----- URL: Shorten -----
	{
		displayName: 'Long URL',
		name: 'url',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
			},
		},
		default: '',
		placeholder: 'https://example.com/some-very-long-page',
		description: 'The long destination URL to shorten. Must start with http:// or https://',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
			},
		},
		default: '',
		placeholder: 'My Campaign Link',
		description: 'Optional display name to help organize your links',
	},
	{
		displayName: 'Link Branding',
		name: 'linkBranding',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
			},
		},
		options: [
			{
				name: 'Standard (jmpy.me)',
				value: 'standard',
			},
			{
				name: 'Subdomain',
				value: 'subdomain',
			},
			{
				name: 'Branded Domain',
				value: 'branded',
			},
		],
		default: 'standard',
		description: 'Choose how to brand your short URL',
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
				resource: ['url'],
				operation: ['shorten'],
				linkBranding: ['subdomain'],
			},
		},
		default: '',
		description: 'Choose one of your verified subdomains',
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
				resource: ['url'],
				operation: ['shorten'],
				linkBranding: ['branded'],
			},
		},
		default: '',
		description: 'Choose one of your verified branded domains',
	},
	{
		displayName: 'Campaign Option',
		name: 'campaignOption',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
			},
		},
		options: [
			{
				name: 'No Campaign',
				value: 'none',
			},
			{
				name: 'Select Existing Campaign',
				value: 'existing',
			},
			{
				name: 'Create New Campaign',
				value: 'create',
			},
		],
		default: 'none',
		description: 'Choose whether to associate this short URL with a campaign',
	},
	{
		displayName: 'Select Campaign',
		name: 'campaignId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getCampaigns',
		},
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
				campaignOption: ['existing'],
			},
		},
		default: '',
		description: 'Choose one of your campaigns',
	},
	{
		displayName: 'New Campaign Name',
		name: 'newCampaignName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
				campaignOption: ['create'],
			},
		},
		default: '',
		placeholder: 'Winter Sale 2026',
		description: 'Enter a name for the new campaign',
	},
	{
		displayName: 'Is Dynamic',
		name: 'isDynamic',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
			},
		},
		default: false,
		description: 'Whether to create a dynamic short URL (302 redirect that can be updated later)',
	},
	{
		displayName: 'Tracking Enabled',
		name: 'trackingEnabled',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
			},
		},
		default: true,
		description: 'Whether to track click analytics for this short URL',
	},
	{
		displayName: 'Generate QR Code',
		name: 'qrCode',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
			},
		},
		default: false,
		description: 'Whether to generate a trackable QR code alongside the short URL',
	},
	{
		displayName: 'QR Format',
		name: 'qrFormat',
		type: 'options',
		options: [
			{ name: 'Image (PNG)', value: 'image' },
			{ name: 'JSON Data', value: 'json' },
		],
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['shorten'],
				qrCode: [true],
			},
		},
		default: 'image',
		description: 'Format for the returned QR code',
	},

	// ----- URL: Get Detail -----
	{
		displayName: 'Short URL',
		name: 'shortUrl',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['get'],
			},
		},
		default: '',
		placeholder: 'https://jmpy.me/abc',
		description: 'The full short URL to look up (e.g., https://jmpy.me/abc)',
	},

	// ----- URL: Delete -----
	{
		displayName: 'Short URL, or ID or short Code',
		name: 'shortUrlId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['delete'],
			},
		},
		default: '',
		description: 'The Short URL, or ID or short Code of the URL to delete',
	},

	// ----- URL: List -----
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['list'],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Page',
		name: 'page',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['list'],
			},
		},
		default: 1,
		description: 'Page number for pagination',
	},

	// ----- URL: Update -----
	{
		displayName: 'Short URL, or ID or short Code',
		name: 'shortUrlId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['update'],
			},
		},
		default: '',
		description: 'The Short URL, or ID or short Code of the URL to update',
	},
	{
		displayName: 'New Destination URL',
		name: 'url',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['update'],
			},
		},
		default: '',
		placeholder: 'https://example.com/new-page',
		description: 'The new destination URL to redirect to',
	},
	{
		displayName: 'New Display Name',
		name: 'name',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['update'],
			},
		},
		default: '',
		placeholder: 'My Updated Campaign',
		description: 'New display name for the shortened URL',
	},
	{
		displayName: 'New Custom Alias',
		name: 'custom_alias',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['update'],
			},
		},
		default: '',
		placeholder: 'new-alias',
		description: 'The new custom alias for the URL slug (WARNING: Changing this will break existing links)',
	},
	{
		displayName: 'New Expiration Date',
		name: 'expiresAt',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['update'],
			},
		},
		default: '',
		description: 'New expiration date and time in ISO format',
	},
	{
		displayName: 'Tracking Enabled',
		name: 'trackingEnabled',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['update'],
			},
		},
		default: true,
		description: 'Whether to enable tracking for this shortened URL',
	},
];
