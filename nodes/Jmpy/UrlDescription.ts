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
		displayName: 'Short URL or Short ID',
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
		placeholder: 'e.g. https://jmpy.me/abc123 or abc123',
		description: 'The Short URL or Short ID of the URL to delete',
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
				resource: ['url'],
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
	{
		displayName: 'Date Range',
		name: 'dateRange',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['list'],
			},
		},
		options: [
			{ name: 'All Time', value: 'all_time' },
			{ name: 'Last Hour', value: 'last_hour' },
			{ name: 'Last 24 Hours', value: 'last_24_hours' },
			{ name: 'Last 7 Days', value: 'last_7_days' },
			{ name: 'Last 30 Days', value: 'last_30_days' },
			{ name: 'Last Year', value: 'last_year' },
			{ name: 'Custom Range', value: 'custom' },
		],
		default: 'all_time',
		description: 'Filter URLs created within this date range',
	},
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['list'],
				dateRange: ['custom'],
			},
		},
		default: '',
		placeholder: '2026-01-01T00:00:00Z',
		description: 'Custom start date for filtering (ISO 8601 format)',
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['list'],
				dateRange: ['custom'],
			},
		},
		default: '',
		placeholder: '2026-12-31T23:59:59Z',
		description: 'Custom end date for filtering (ISO 8601 format)',
	},

	// ----- URL: Update -----
	{
		displayName: 'Short URL or Short ID',
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
		placeholder: 'e.g. https://jmpy.me/abc123 or abc123',
		description: 'The Short URL or Short ID of the URL to update',
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
		displayName: 'Campaign Option',
		name: 'campaignOption',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['url'],
				operation: ['update'],
			},
		},
		options: [
			{
				name: 'No Campaign / Keep Unchanged',
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
				operation: ['update'],
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
				operation: ['update'],
				campaignOption: ['create'],
			},
		},
		default: '',
		placeholder: 'Winter Sale 2026',
		description: 'Enter a name for the new campaign',
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
