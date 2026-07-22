import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	INodePropertyOptions,
	ILoadOptionsFunctions,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

// Base URL for Jmpy.me API
const API_BASE_URL = 'https://jmpy.me';

function parseMcpResponse(response: any): any {
	if (response && Array.isArray(response.content)) {
		const textBlock = response.content.find((c: any) => c.type === 'text');
		if (textBlock && textBlock.text) {
			try {
				const parsed = JSON.parse(textBlock.text);
				return parsed.data || parsed;
			} catch (e) {
				return { text: textBlock.text };
			}
		}
	}
	if (response && response.success) {
		return response.data || response;
	}
	return response;
}

/**
 * Map n8n event keys to Jmpy webhook event_type values
 */
const EVENT_TYPE_MAP: Record<string, string> = {
	// URL events
	'urlCreated': 'link.created',
	'urlClicked': 'link.clicked',
	'urlClickedUnique': 'link.clicked.unique',
	'urlClickedUtm': 'link.clicked.utm',
	// QR events
	'qrCreated': 'qr.created',
	'qrScanned': 'qr.scanned',
	'qrScannedUnique': 'qr.scanned.unique',
};

export class JmpyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Jmpy.me Trigger',
		name: 'jmpyTrigger',
		icon: 'file:logo.png',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Triggers when events happen in Jmpy.me (link clicks, QR scans, new URLs, etc.)',
		defaults: {
			name: 'Jmpy.me Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'jmpyOAuth2Api',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				default: 'urlCreated',
				options: [
					{
						name: 'New Short URL Created (Requires Business Plan)',
						value: 'urlCreated',
						description: 'Triggers immediately when a new short URL is created (requires Business plan)',
					},
					{
						name: 'Link Clicked (Requires Business Plan)',
						value: 'urlClicked',
						description: 'Triggers immediately when any short URL is clicked (requires Business plan)',
					},
					{
						name: 'Link Clicked (Unique Visitor, Requires Business Plan)',
						value: 'urlClickedUnique',
						description: 'Triggers immediately when a short URL is clicked by a unique visitor (deduplicated over 24h, requires Business plan)',
					},
					{
						name: 'Link Clicked (With UTM, Requires Business Plan)',
						value: 'urlClickedUtm',
						description: 'Triggers immediately when a short URL with UTM parameters is clicked (requires Business plan)',
					},
					{
						name: 'New QR Code Created (Requires Business Plan)',
						value: 'qrCreated',
						description: 'Triggers immediately when a new QR code is generated (requires Business plan)',
					},
					{
						name: 'QR Code Scanned (Requires Business Plan)',
						value: 'qrScanned',
						description: 'Triggers immediately when any QR code is scanned (requires Business plan)',
					},
					{
						name: 'QR Code Scanned (Unique Visitor, Requires Business Plan)',
						value: 'qrScannedUnique',
						description: 'Triggers immediately when a QR code is scanned by a unique visitor (deduplicated over 24h, requires Business plan)',
					},
				],
			},
			// Short code selection mode — shown for URL click events
			{
				displayName: 'Short URL Filter Mode',
				name: 'shortCodeSelectionMode',
				type: 'options',
				options: [
					{
						name: 'Select from List',
						value: 'list',
						description: 'Select short URLs from a dropdown list',
					},
					{
						name: 'Enter Manually',
						value: 'manual',
						description: 'Enter short codes manually (useful for 4000+ links)',
					},
				],
				default: 'list',
				displayOptions: {
					show: {
						event: [
							'urlClicked',
							'urlClickedUnique',
							'urlClickedUtm',
						],
					},
				},
			},
			// Short code filter (list) — shown for URL click events when mode is list
			{
				displayName: 'Short URLs to Monitor',
				name: 'shortCodes',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getShortUrls',
				},
				default: [],
				required: false,
				description: 'Select one or more short URLs to monitor. Leave empty to monitor all.',
				displayOptions: {
					show: {
						event: [
							'urlClicked',
							'urlClickedUnique',
							'urlClickedUtm',
						],
						shortCodeSelectionMode: [
							'list',
						],
					},
				},
			},
			// Short code filter (manual) — shown for URL click events when mode is manual
			{
				displayName: 'Short Codes/Slugs (Manual)',
				name: 'customShortCodes',
				type: 'string',
				default: '',
				required: false,
				placeholder: 'promo, summer-sale, winter2026',
				description: 'Enter one or more short codes/slugs separated by commas. Leave empty to monitor all.',
				displayOptions: {
					show: {
						event: [
							'urlClicked',
							'urlClickedUnique',
							'urlClickedUtm',
						],
						shortCodeSelectionMode: [
							'manual',
						],
					},
				},
			},
			// QR code selection mode — shown for QR scan events
			{
				displayName: 'QR Code Filter Mode',
				name: 'qrCodeSelectionMode',
				type: 'options',
				options: [
					{
						name: 'Select from List',
						value: 'list',
						description: 'Select QR codes from a dropdown list',
					},
					{
						name: 'Enter Manually',
						value: 'manual',
						description: 'Enter QR Code UUIDs manually (useful for many QR codes)',
					},
				],
				default: 'list',
				displayOptions: {
					show: {
						event: [
							'qrScanned',
							'qrScannedUnique',
						],
					},
				},
			},
			// QR code filter (list) — shown for QR scan events when mode is list
			{
				displayName: 'QR Codes to Monitor',
				name: 'qrCodeIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getQrCodes',
				},
				default: [],
				required: false,
				description: 'Select one or more QR codes to monitor. Leave empty to monitor all.',
				displayOptions: {
					show: {
						event: [
							'qrScanned',
							'qrScannedUnique',
						],
						qrCodeSelectionMode: [
							'list',
						],
					},
				},
			},
			// QR code filter (manual) — shown for QR scan events when mode is manual
			{
				displayName: 'QR Code IDs (Manual)',
				name: 'customQrCodeIds',
				type: 'string',
				default: '',
				required: false,
				placeholder: 'qr-uuid-1, qr-uuid-2',
				description: 'Enter one or more QR Code UUIDs separated by commas. Leave empty to monitor all.',
				displayOptions: {
					show: {
						event: [
							'qrScanned',
							'qrScannedUnique',
						],
						qrCodeSelectionMode: [
							'manual',
						],
					},
				},
			},
			...((() => {
				const webhookUrlEnv = process.env.WEBHOOK_URL || '';
				const isLocal = !webhookUrlEnv ||
					webhookUrlEnv.includes('localhost') ||
					webhookUrlEnv.includes('127.0.0.1') ||
					webhookUrlEnv.includes('192.168.') ||
					webhookUrlEnv.includes('10.');
				if (isLocal) {
					return [{
						displayName: 'Webhook Tunnel URL / Host Override',
						name: 'webhookTunnelUrl',
						type: 'string' as const,
						default: '',
						required: false,
						placeholder: 'https://xxxx.ngrok-free.dev',
						description: 'If you access n8n via a tunnel (e.g. ngrok, Cloudflare) and get a localhost error, enter your public tunnel URL here to override the domain.',
					}];
				}
				return [];
			})()),
			// Campaign filter
			{
				displayName: 'Campaign Name or ID',
				name: 'campaignId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getCampaigns',
				},
				default: '',
				required: false,
				description: 'Select a Campaign to filter by. Only events for URLs/QRs inside this campaign will trigger.',
			},
			{
				displayName: 'Link Branding',
				name: 'url_type',
				type: 'multiOptions',
				options: [
					{ name: 'Standard (jmpy.me)', value: 'standard' },
					{ name: 'Branded Domain', value: 'branded' },
					{ name: 'Subdomain', value: 'subdomain' },
				],
				default: [],
				displayOptions: {
					show: {
						event: [
							'urlCreated',
							'urlClicked',
							'urlClickedUnique',
							'urlClickedUtm',
						],
					},
				},
				description: 'Filter by link structure style. Leave empty to match all link types.',
			},
			{
				displayName: 'QR code Link Branding',
				name: 'url_type',
				type: 'multiOptions',
				options: [
					{ name: 'Standard (jmpy.me)', value: 'standard' },
					{ name: 'Branded Domain', value: 'branded' },
					{ name: 'Subdomain', value: 'subdomain' },
				],
				default: [],
				displayOptions: {
					show: {
						event: [
							'qrCreated',
							'qrScanned',
							'qrScannedUnique',
						],
					},
				},
				description: 'Filter by QR code branding style. Leave empty to match all branding types.',
			},
			{
				displayName: 'Branded Domains',
				name: 'branded_domain',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getBrandedDomains',
				},
				default: [],
				displayOptions: {
					show: {
						url_type: [
							'branded',
						],
					},
				},
				description: 'Filter by specific branded domains. If empty, triggers for all branded domains. (Only applies to Branded Domain Link Branding).',
			},
			{
				displayName: 'Subdomains',
				name: 'subdomain',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getSubdomains',
				},
				default: [],
				displayOptions: {
					show: {
						url_type: [
							'subdomain',
						],
					},
				},
				description: 'Filter by specific subdomains. If empty, triggers for all subdomains. (Only applies to Subdomain Link Branding).',
			},
			// Additional filters
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				description: 'Filter the events by payload values before triggering',
				options: [
					{
						displayName: 'Is Dynamic',
						name: 'is_dynamic',
						type: 'boolean',
						default: false,
						description: 'Whether the URL or QR code is dynamic. Use case: monitor links where the destination can change.',
					},
					{
						displayName: 'Is Password Protected',
						name: 'is_password_protected',
						type: 'boolean',
						default: false,
						description: 'Whether the URL or QR code has password protection. Use case: track scans/clicks of secure assets.',
					},
					{
						displayName: 'Has UTM Parameters',
						name: 'has_utm_params',
						type: 'boolean',
						default: false,
						displayOptions: {
							hide: {
								'/event': [
									'qrCreated',
									'qrScanned',
									'qrScannedUnique',
								],
							},
						},
						description: 'Only trigger if the link contains Google Analytics UTM tracking parameters. Use case: track marketing campaigns.',
					},
					{
						displayName: 'Tags (Comma-Separated)',
						name: 'tags',
						type: 'string',
						default: '',
						displayOptions: {
							hide: {
								'/event': [
									'qrCreated',
									'qrScanned',
									'qrScannedUnique',
								],
							},
						},
						description: 'Only trigger if the link/QR code contains all these specified tags. Separate tags with commas. Use case: filter by custom tag categories.',
					},
					{
						displayName: 'Is Expiring',
						name: 'is_expiring',
						type: 'boolean',
						default: false,
						description: 'Only trigger for links/QR codes that have a set expiration date/time configured. Use case: track temporary links.',
					},
					{
						displayName: 'Custom Alias',
						name: 'custom_alias',
						type: 'boolean',
						default: false,
						description: 'Whether the short URL has a custom alias. Use case: track links with any custom alias.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getShortUrls(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('jmpyOAuth2Api');
					if (!credentials || !credentials.oauthTokenData || !(credentials.oauthTokenData as any).access_token) {
						throw new NodeApiError(this.getNode(), { message: 'Authentication required' } as any, {
							message: 'Authentication required',
							description: 'Please connect and authenticate your Jmpy.me account first.',
						});
					}
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/mcp/execute/listUrls`,
						body: { limit: 100, sortBy: 'created_at', sortOrder: 'desc', tracked: 'true' },
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.shortUrls || data.urls || [];
					const options: INodePropertyOptions[] = [];
					for (const item of items) {
						options.push({
							name: `${item.short_url || item.short_code} ${item.name ? `(${item.name})` : ''}`.trim(),
							value: item.short_code || item.id,
						});
					}
					return options;
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as any);
				}
			},
			async getQrCodes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('jmpyOAuth2Api');
					if (!credentials || !credentials.oauthTokenData || !(credentials.oauthTokenData as any).access_token) {
						throw new NodeApiError(this.getNode(), { message: 'Authentication required' } as any, {
							message: 'Authentication required',
							description: 'Please connect and authenticate your Jmpy.me account first.',
						});
					}
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/mcp/execute/listQrCodes`,
						body: { limit: 100, sortBy: 'created_at', sortOrder: 'desc', qrType: 'tracked' },
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.qrCodes || [];
					const options: INodePropertyOptions[] = [];
					for (const item of items) {
						options.push({
							name: item.name || `QR Code (${item.content_type || 'url'})`,
							value: item.id,
						});
					}
					return options;
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as any);
				}
			},
			async getCampaigns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('jmpyOAuth2Api');
					if (!credentials || !credentials.oauthTokenData || !(credentials.oauthTokenData as any).access_token) {
						throw new NodeApiError(this.getNode(), { message: 'Authentication required' } as any, {
							message: 'Authentication required',
							description: 'Please connect and authenticate your Jmpy.me account first.',
						});
					}
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/mcp/execute/listCampaigns`,
						body: { limit: 100, is_polling: true },
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.campaigns || [];
					return items.map((item: any) => ({
						name: item.name,
						value: item.id,
					}));
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as any);
				}
			},
			async getSubdomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('jmpyOAuth2Api');
					if (!credentials || !credentials.oauthTokenData || !(credentials.oauthTokenData as any).access_token) {
						throw new NodeApiError(this.getNode(), { message: 'Authentication required' } as any, {
							message: 'Authentication required',
							description: 'Please connect and authenticate your Jmpy.me account first.',
						});
					}
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/mcp/execute/getUserSubdomains`,
						body: {},
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.subdomains || [];
					if (items.length === 0) {
						return [{ name: 'No subdomain is added yet', value: '' }];
					}
					return items.map((item: any) => ({
						name: item.subdomain || item.name || item.fullDomain || item.id,
						value: item.subdomain || item.name || item.id,
					}));
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as any);
				}
			},
			async getBrandedDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('jmpyOAuth2Api');
					if (!credentials || !credentials.oauthTokenData || !(credentials.oauthTokenData as any).access_token) {
						throw new NodeApiError(this.getNode(), { message: 'Authentication required' } as any, {
							message: 'Authentication required',
							description: 'Please connect and authenticate your Jmpy.me account first.',
						});
					}
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/mcp/execute/getUserDomains`,
						body: {},
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.branded || [];
					if (items.length === 0) {
						return [{ name: 'No branded domain is added yet', value: '' }];
					}
					return items.map((item: any) => ({
						name: item.domain,
						value: item.domain,
					}));
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as any);
				}
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const workflowId = this.getWorkflow().id;
				return webhookData.webhookId !== undefined && webhookData.workflowId === workflowId;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				let webhookUrl = this.getNodeWebhookUrl('default') as string;
				
				try {
					let tunnelUrl = this.getNodeParameter('webhookTunnelUrl', '') as string;
					if (tunnelUrl) {
						tunnelUrl = tunnelUrl.trim().replace(/\/$/, '');
						if (!tunnelUrl.startsWith('http://') && !tunnelUrl.startsWith('https://')) {
							tunnelUrl = 'https://' + tunnelUrl;
						}
						webhookUrl = webhookUrl.replace(/^https?:\/\/[^/]+/, tunnelUrl);
					}
				} catch (e) {
					// Ignore if parameter is not present
				}

				if (webhookUrl && (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1'))) {
					throw new NodeApiError(this.getNode(), { message: 'Invalid Webhook URL' } as any, {
						message: 'Cannot use localhost for Webhook Triggers',
						description: 'Jmpy.me cannot send events to a localhost URL. The \'Webhook Tunnel URL / Host Override\' parameter is empty. Please enter your public tunnel URL (e.g., https://your-tunnel.ngrok-free.dev) in the node settings for working on localhost, or use the Polling Triggers instead.',
					});
				}

				const event = this.getNodeParameter('event') as string;
				const eventType = EVENT_TYPE_MAP[event];

				if (!eventType) {
					throw new Error(`Unknown event type: ${event}`);
				}

				const body: any = {
					event_type: eventType,
					target_url: webhookUrl,
					filters: {},
				};

				try {
					const campaignId = this.getNodeParameter('campaignId') as string;
					if (campaignId) {
						body.filters.campaign_id = campaignId;
					}
				} catch (e) {}

				try {
					const urlType = (this.getNodeParameter('url_type') as string[] || []).filter(Boolean);
					if (urlType && urlType.length > 0) {
						body.filters.url_type = urlType;
					}
				} catch (e) {}

				try {
					const brandedDomain = (this.getNodeParameter('branded_domain') as string[] || []).filter(Boolean);
					if (brandedDomain && brandedDomain.length > 0) {
						body.filters.branded_domain = brandedDomain;
					}
				} catch (e) {}

				try {
					const subdomain = (this.getNodeParameter('subdomain') as string[] || []).filter(Boolean);
					if (subdomain && subdomain.length > 0) {
						body.filters.subdomain = subdomain;
					}
				} catch (e) {}

				try {
					const filterValues = this.getNodeParameter('filters') as any;
					if (filterValues) {
						if (filterValues.is_dynamic !== undefined) body.filters.is_dynamic = filterValues.is_dynamic;
						if (filterValues.is_password_protected !== undefined) body.filters.is_password_protected = filterValues.is_password_protected;
						if (filterValues.has_utm_params !== undefined) body.filters.has_utm_params = filterValues.has_utm_params;
						if (filterValues.is_expiring !== undefined) body.filters.is_expiring = filterValues.is_expiring;
						if (filterValues.custom_alias !== undefined) body.filters.custom_alias = filterValues.custom_alias;
						if (filterValues.tags) {
							body.filters.tags = filterValues.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
						}
					}
				} catch (e) {}

				// Add filter for click events
				const clickEvents = ['urlClicked', 'urlClickedUnique', 'urlClickedUtm'];
				if (clickEvents.includes(event)) {
					try {
						const mode = this.getNodeParameter('shortCodeSelectionMode') as string;
						if (mode === 'list') {
							const shortCodes = this.getNodeParameter('shortCodes') as string[];
							if (shortCodes && shortCodes.length > 0) {
								body.short_code = shortCodes.join(',');
							}
						} else {
							const custom = this.getNodeParameter('customShortCodes') as string;
							if (custom) {
								const parsed = custom.split(',').map(s => s.trim()).filter(Boolean);
								if (parsed.length > 0) {
									body.short_code = parsed.join(',');
								}
							}
						}
					} catch (e) {
						// Parameter not set, monitor all
					}
				}

				// Add filter for scan events
				const scanEvents = ['qrScanned', 'qrScannedUnique'];
				if (scanEvents.includes(event)) {
					try {
						const mode = this.getNodeParameter('qrCodeSelectionMode') as string;
						if (mode === 'list') {
							const qrCodeIds = this.getNodeParameter('qrCodeIds') as string[];
							if (qrCodeIds && qrCodeIds.length > 0) {
								body.qr_code_id = qrCodeIds.join(',');
							}
						} else {
							const custom = this.getNodeParameter('customQrCodeIds') as string;
							if (custom) {
								const parsed = custom.split(',').map(s => s.trim()).filter(Boolean);
								if (parsed.length > 0) {
									body.qr_code_id = parsed.join(',');
								}
							}
						}
					} catch (e) {
						// Parameter not set, monitor all
					}
				}

				let response;
				try {
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/api/v1/webhooks/subscriptions`,
						body,
						json: true,
						returnFullResponse: true,
						ignoreHttpStatusErrors: true,
					});
				} catch (error: any) {
					throw new NodeApiError(this.getNode(), error as any, {
						message: 'Failed to create webhook subscription',
						description: 'Could not reach the Jmpy.me API. Please check your credentials and try again.',
						httpCode: String(error.statusCode || error.httpCode || 500),
					});
				}

				// Handle non-2xx responses manually so we can extract the custom error message
				const statusCode = response.statusCode || response.status || 200;
				if (statusCode >= 400) {
					const responseBody = response.body || response;
					let errorMessage = 'Failed to create webhook subscription';
					let errorDescription = '';

					// Extract custom error message from API response body
					if (responseBody && typeof responseBody === 'object') {
						// API returns { error: "message", detail: "message", message: "message" }
						errorMessage = responseBody.detail || responseBody.error || responseBody.message || errorMessage;
						errorDescription = responseBody.suggestion || responseBody.hint || errorMessage;
					} else if (typeof responseBody === 'string') {
						try {
							const parsed = JSON.parse(responseBody);
							errorMessage = parsed.detail || parsed.error || parsed.message || errorMessage;
							errorDescription = parsed.suggestion || parsed.hint || errorMessage;
						} catch (e) {
							errorMessage = responseBody || errorMessage;
						}
					}

					throw new NodeOperationError(this.getNode(), errorMessage);
				}

				const successBody = response.body || response;
				const responseData = successBody.data || successBody;
				if (!responseData || !responseData.id) {
					throw new Error('Failed to create webhook subscription');
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = responseData.id;
				webhookData.workflowId = this.getWorkflow().id;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.webhookId as string;

				if (webhookId) {
					try {
						await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
							method: 'DELETE',
							url: `${API_BASE_URL}/api/v1/webhooks/subscriptions/${webhookId}`,
							json: true,
						});
					} catch (e) {
						// Subscription may already be deleted
					}
					delete webhookData.webhookId;
					delete webhookData.workflowId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData() as any;
		const event = this.getNodeParameter('event') as string;

		const payload = bodyData.data || bodyData;

		// ----- Event-specific filters -----

		// URL created: exclude QR source
		if (event === 'urlCreated') {
			if (payload.source === 'QR_CODE_GENERATOR') {
				return { workflowData: [] };
			}
		}

		// Click/scan filter by short_code or qr_code_id
		const clickEvents = ['urlClicked', 'urlClickedUnique', 'urlClickedUtm'];
		const scanEvents = ['qrScanned', 'qrScannedUnique'];

		if (clickEvents.includes(event)) {
			try {
				const mode = this.getNodeParameter('shortCodeSelectionMode') as string;
				let activeCodes: string[] = [];
				if (mode === 'list') {
					activeCodes = this.getNodeParameter('shortCodes') as string[];
				} else {
					const custom = this.getNodeParameter('customShortCodes') as string;
					if (custom) {
						activeCodes = custom.split(',').map(s => s.trim()).filter(Boolean);
					}
				}
				if (activeCodes && activeCodes.length > 0 && !activeCodes.includes(payload.short_code)) {
					return { workflowData: [] };
				}
			} catch (e) {
				// No filter
			}
		}

		if (scanEvents.includes(event)) {
			try {
				const mode = this.getNodeParameter('qrCodeSelectionMode') as string;
				let activeIds: string[] = [];
				if (mode === 'list') {
					activeIds = this.getNodeParameter('qrCodeIds') as string[];
				} else {
					const custom = this.getNodeParameter('customQrCodeIds') as string;
					if (custom) {
						activeIds = custom.split(',').map(s => s.trim()).filter(Boolean);
					}
				}
				if (activeIds && activeIds.length > 0 && !activeIds.includes(payload.qr_code_id)) {
					return { workflowData: [] };
				}
			} catch (e) {
				// No filter
			}
		}

		// Variant-specific filters
		if (event === 'urlClickedUnique' || event === 'qrScannedUnique') {
			if (payload.is_unique !== true) {
				return { workflowData: [] };
			}
		}

		if (event === 'urlClickedUtm') {
			const hasUtm = payload.utm && (
				payload.utm.utm_source || payload.utm.utm_medium ||
				payload.utm.utm_campaign || payload.utm.utm_term || payload.utm.utm_content
			);
			if (!hasUtm) {
				return { workflowData: [] };
			}
		}

		// Format based on event type
		let returnItem: any;
		if (event === 'urlCreated') {
			returnItem = formatUrlCreatedPayload(payload);
		} else if (event === 'qrCreated') {
			returnItem = formatQrCreatedPayload(payload);
		} else if (clickEvents.includes(event)) {
			if (event === 'urlClickedUtm') {
				returnItem = formatClickUtmPayload(payload);
			} else {
				returnItem = formatClickPayload(payload, event.includes('Unique'));
			}
		} else if (scanEvents.includes(event)) {
			returnItem = formatScanPayload(payload, event.includes('Unique'));
		} else {
			returnItem = payload;
		}

		// Merge envelope metadata fields if present
		if (bodyData.event_id) {
			returnItem.event_id = bodyData.event_id;
			returnItem.event_type = bodyData.event;
			returnItem.webhook_subscription_id = bodyData.subscription_id;
			returnItem.webhook_timestamp = bodyData.timestamp;
		}

		return {
			workflowData: [
				this.helpers.returnJsonArray([returnItem]),
			],
		};
	}
}

function cleanResponseData(obj: any): any {
	if (!obj || typeof obj !== 'object') return obj;

	if (Array.isArray(obj)) {
		return obj.map((item: any) => cleanResponseData(item));
	}

	if (obj.urls && Array.isArray(obj.urls)) {
		obj.urls = obj.urls.map((item: any) => cleanResponseData(item));
	}
	if (obj.shortUrls && Array.isArray(obj.shortUrls)) {
		obj.shortUrls = obj.shortUrls.map((item: any) => cleanResponseData(item));
	}
	if (obj.qrCodes && Array.isArray(obj.qrCodes)) {
		obj.qrCodes = obj.qrCodes.map((item: any) => cleanResponseData(item));
	}

	if (obj.qr_code_response && typeof obj.qr_code_response === 'object') {
		const qrResp = obj.qr_code_response;
		const dlUrl = qrResp.downloadUrl || qrResp.data?.downloadUrl || qrResp.qr_code || qrResp.data?.qr_code;
		if (dlUrl && typeof dlUrl === 'string' && dlUrl.startsWith('http')) {
			obj.qr_code_url = dlUrl;
		}
	}

	if (obj.qr_code) {
		if (typeof obj.qr_code === 'string' && obj.qr_code.startsWith('http')) {
			obj.qr_code_url = obj.qr_code;
		} else if (typeof obj.qr_code === 'object') {
			const dlUrl = obj.qr_code.png || obj.qr_code.downloadUrl || obj.qr_code.download_url || obj.qr_code.url;
			if (dlUrl && typeof dlUrl === 'string' && dlUrl.startsWith('http')) {
				obj.qr_code_url = dlUrl;
			}
		}
	}
	if (obj.qrCode) {
		if (typeof obj.qrCode === 'string' && obj.qrCode.startsWith('http')) {
			obj.qr_code_url = obj.qrCode;
		} else if (typeof obj.qrCode === 'object') {
			const dlUrl = obj.qrCode.png || obj.qrCode.downloadUrl || obj.qrCode.download_url || obj.qrCode.url;
			if (dlUrl && typeof dlUrl === 'string' && dlUrl.startsWith('http')) {
				obj.qr_code_url = dlUrl;
			}
		}
	}

	const rootDlUrl = obj.downloadUrl || obj.download_url || obj.qrCodeUrl;
	if (rootDlUrl && typeof rootDlUrl === 'string' && rootDlUrl.startsWith('http')) {
		obj.qr_code_url = rootDlUrl;
	}

	if (obj.qr_code_url && typeof obj.qr_code_url === 'string') {
		obj.qr_code_html = `<img src="${obj.qr_code_url}" alt="QR Code" width="200" height="200" />`;
		obj.qr_code_excel_sheet_formula = `=IMAGE("${obj.qr_code_url}")`;
		obj.qr_code_excel_sheet_formula_IMAGE = obj.qr_code_url;
	}


	const isSafe = !obj.safety_status || obj.safety_status === 'safe';
	const keysToDelete = [
		'qr_content', 'qrContent',
		'qr_code_data', 'qrCodeData',
		'qr_code', 'qrCode',
		'qr_code_response',
		'dataURL',
		'dataUrl',
		'base64',
		'download_url', 'downloadUrl',
		'width', 'height',
		'channel',
		'click_count', 'clickCount'
	];
	if (isSafe) {
		keysToDelete.push('safety_status', 'safetyStatus', 'safety_reason', 'safetyReason', 'safety_report', 'safetyReport');
	} else {
		keysToDelete.push('safety_reason', 'safetyReason', 'safety_report', 'safetyReport');
	}
	keysToDelete.forEach(k => {
		delete obj[k];
	});

	if (obj.original_url !== undefined) {
		obj.destination_url = obj.original_url;
		delete obj.original_url;
	}
	if (obj.url_type !== undefined) {
		obj.link_branding = obj.url_type;
		delete obj.url_type;
	}

	const isQrCodeObj = obj.content_type !== undefined || obj.qr_content !== undefined || obj.visual_settings !== undefined;
	if (obj.id !== undefined) {
		if (isQrCodeObj) {
			obj.qr_code_id = obj.id;
		} else {
			obj.short_code_id = obj.id;
		}
		delete obj.id;
	}

	const branding = obj.link_branding || obj.url_type;
	if (branding !== undefined) {
		obj.link_branding = branding;
		obj.branded = (branding === 'branded' || branding === 'subdomain') ? 'yes' : 'no';
	} else if (obj.domain) {
		obj.link_branding = obj.domain === 'jmpy.me' ? 'standard' : 'branded';
		obj.branded = obj.domain === 'jmpy.me' ? 'no' : 'yes';
	} else {
		obj.link_branding = 'standard';
		obj.branded = 'no';
	}


	if (obj.destination_url !== undefined) {
		const destUrl = obj.destination_url;
		if (destUrl && typeof destUrl === 'string') {
			try {
				const urlToCheck = destUrl.startsWith('http') ? destUrl : 'https://' + destUrl;
				const parsedUrl = new URL(urlToCheck);
				obj.utm_source = parsedUrl.searchParams.get('utm_source') || null;
				obj.utm_medium = parsedUrl.searchParams.get('utm_medium') || null;
				obj.utm_campaign = parsedUrl.searchParams.get('utm_campaign') || null;
				obj.utm_term = parsedUrl.searchParams.get('utm_term') || null;
				obj.utm_content = parsedUrl.searchParams.get('utm_content') || null;
			} catch (e) {
				obj.utm_source = null;
				obj.utm_medium = null;
				obj.utm_campaign = null;
				obj.utm_term = null;
				obj.utm_content = null;
			}
		} else {
			obj.utm_source = null;
			obj.utm_medium = null;
			obj.utm_campaign = null;
			obj.utm_term = null;
			obj.utm_content = null;
		}
	}


	return obj;
}

function formatUrlCreatedPayload(data: any) {
	const cleaned = cleanResponseData({ ...data });
	const result: any = {
		name: cleaned.name || '',
		campaign_id: cleaned.campaign_id || null,
		campaign_name: cleaned.campaign_name || null,
		short_code: cleaned.short_code || '',
		short_url: cleaned.short_url || '',
		destination_url: cleaned.destination_url || cleaned.original_url || '',
		is_password_protected: cleaned.is_password_protected ?? false,
		expires_at: cleaned.expires_at || null,
		is_dynamic: cleaned.is_dynamic ?? false,
		tracking_enabled: cleaned.tracking_enabled ?? true,
		created_at: cleaned.created_at || new Date().toISOString(),
		channel: cleaned.channel || 'n8n',
		short_code_id: cleaned.short_code_id || cleaned.id || '',
		utm_source: cleaned.utm_source || null,
		utm_medium: cleaned.utm_medium || null,
		utm_campaign: cleaned.utm_campaign || null,
		utm_term: cleaned.utm_term || null,
		utm_content: cleaned.utm_content || null,
		link_branding: cleaned.link_branding || cleaned.branded || 'no',
		subdomain: cleaned.subdomain || null,
		branded_domain: cleaned.branded_domain || null,
		custom_alias: cleaned.custom_alias || null,
		tags: cleaned.tags || [],
		has_utm_params: cleaned.has_utm_params ?? false,
	};

	if (cleaned.qr_code_url) {
		result.qr_code_url = cleaned.qr_code_url;
		result.qr_code_html = cleaned.qr_code_html || `<img src="${cleaned.qr_code_url}" alt="QR Code" width="200" height="200" />`;
		result.qr_code_excel_sheet_formula = cleaned.qr_code_excel_sheet_formula || `=IMAGE("${cleaned.qr_code_url}")`;
	}

	if (cleaned.safety_status && cleaned.safety_status !== 'safe') {
		result.safety_status = cleaned.safety_status;
	}
	
	return result;
}

function formatQrCreatedPayload(data: any) {
	return cleanResponseData({ ...data });
}

function formatClickPayload(data: any, includeUnique: boolean = false) {
	const isQr = data.is_qr_scan === true || data.is_qr_scan === 'true' || !!data.scan_id || data.interaction_type === 'qr_scan';
	const rawId = data.click_id || data.scan_id || data.interaction_id || data.id || '';

	const geo = data.geo || {};
	const device = data.device || {};
	const traffic = data.traffic || {};
	const utm = data.utm || {};

	const branding = data.link_branding || data.url_type || data.urlType || 'standard';
	const branded_domain = branding === 'branded' ? (data.branded_domain || data.brandedDomain || null) : null;
	const subdomain = branding === 'subdomain' ? (data.subdomain || null) : null;

	const result: any = {
		click_id: isQr ? null : rawId,
		clicked_at: data.clicked_at || data.scanned_at || new Date().toISOString(),
		interaction_click: isQr ? null : 'Click',
		interaction_scan: isQr ? 'Scan' : null,
		interaction_type: isQr ? 'qr_scan' : 'click',
		short_code: data.short_code || '',
		short_url: data.short_url || (data.branded_domain ? `https://${data.branded_domain}/${data.custom_alias || data.short_code}` : (data.subdomain ? `https://${data.subdomain}.jmpy.me/${data.custom_alias || data.short_code}` : (data.short_code ? `https://jmpy.me/${data.short_code}` : ''))),
		destination_url: data.original_url || data.destination_url || '',
		link_branding: branding,
		branded_domain,
		subdomain,
		is_dynamic: data.is_dynamic ?? data.isDynamic ?? false,
		is_password_protected: data.is_password_protected ?? data.isPasswordProtected ?? false,
		expires_at: data.expires_at || data.expiresAt || null,
		tags: data.tags || [],
		campaign_id: data.campaign_id || data.campaignId || null,
		campaign_name: data.campaign_name || data.campaignName || null,

		geo__country: geo.country || data.country || '',
		geo__country_code: geo.country_code || data.country_code || '',
		geo__region: geo.region || data.region || '',
		geo__city: geo.city || data.city || '',
		geo__timezone: geo.timezone || data.timezone || '',

		device__device_type: device.device_type || data.device_type || '',
		device__device_brand: device.device_brand || data.device_brand || '',
		device__device_model: device.device_model || data.device_model || '',
		device__browser: device.browser || data.browser || '',
		device__browser_version: device.browser_version || data.browser_version || '',
		device__os: device.os || data.os || '',
		device__os_version: device.os_version || data.os_version || '',
		device__os_platform: device.os_platform || data.os_platform || '',

		traffic__traffic_source: traffic.traffic_source || data.traffic_source || '',
		traffic__traffic_medium: traffic.traffic_medium || data.traffic_medium || '',
		traffic__organic_vs_paid: traffic.organic_vs_paid || data.organic_vs_paid || '',
		traffic__referer: traffic.referer || data.referer || data.referrer || data.referrer_url || '',
		traffic__referrer_domain: traffic.referrer_domain || data.referrer_domain || '',

		utm__utm_source: utm.utm_source || data.utm_source || '',
		utm__utm_medium: utm.utm_medium || data.utm_medium || '',
		utm__utm_campaign: utm.utm_campaign || data.utm_campaign || '',
		utm__utm_term: utm.utm_term || data.utm_term || '',
		utm__utm_content: utm.utm_content || data.utm_content || ''
	};

	if (includeUnique) {
		result.is_unique = data.is_unique ?? true;
	}

	return result;
}

function formatClickUtmPayload(data: any) {
	const isQr = data.is_qr_scan === true || data.is_qr_scan === 'true' || !!data.scan_id || data.interaction_type === 'qr_scan';
	const rawId = data.click_id || data.scan_id || data.interaction_id || data.id || '';

	const branding = data.link_branding || data.url_type || data.urlType || 'standard';
	const branded_domain = branding === 'branded' ? (data.branded_domain || data.brandedDomain || null) : null;
	const subdomain = branding === 'subdomain' ? (data.subdomain || null) : null;

	return {
		click_id: isQr ? null : rawId,
		clicked_at: data.clicked_at || new Date().toISOString(),
		interaction_click: isQr ? null : 'Click',
		interaction_scan: isQr ? 'Scan' : null,
		interaction_type: isQr ? 'qr_scan' : 'click',
		short_code: data.short_code || '',
		short_url: data.short_url || (data.branded_domain ? `https://${data.branded_domain}/${data.custom_alias || data.short_code}` : (data.subdomain ? `https://${data.subdomain}.jmpy.me/${data.custom_alias || data.short_code}` : (data.short_code ? `https://jmpy.me/${data.short_code}` : ''))),
		destination_url: data.original_url || data.destination_url || '',
		link_branding: branding,
		branded_domain,
		subdomain,
		utm_source: data.utm?.utm_source || data.utm_source || null,
		utm_medium: data.utm?.utm_medium || data.utm_medium || null,
		utm_campaign: data.utm?.utm_campaign || data.utm_campaign || null,
		utm_term: data.utm?.utm_term || data.utm_term || null,
		utm_content: data.utm?.utm_content || data.utm_content || null,
		campaign_id: data.campaign_id || data.campaignId || '',
		campaign_name: data.campaign_name || data.campaignName || '',
	};
}

function formatScanPayload(data: any, includeUnique: boolean = false) {
	const geo = data.geo || {};
	const device = data.device || {};
	const traffic = data.traffic || {};

	const branding = data.qr_code_link_branding || data.url_type || data.urlType || 'standard';
	const branded_domain = branding === 'branded' ? (data.branded_domain || data.brandedDomain || null) : null;
	const subdomain = branding === 'subdomain' ? (data.subdomain || null) : null;

	const result: any = {
		scan_id: data.scan_id || data.id || '',
		scanned_at: data.scanned_at || new Date().toISOString(),
		qr_code_id: data.qr_code_id || '',
		qr_code_name: data.qr_code_name || '',
		content_type: data.content_type || 'url',
		qr_content: data.qr_content || '',
		interaction_click: null,
		interaction_scan: 'Scan',
		interaction_type: 'qr_scan',
		short_code: data.short_code || '',
		short_url: data.short_url || '',
		destination_url: data.original_url || data.destination_url || '',
		link_branding: branding,
		branded_domain,
		subdomain,
		is_dynamic: data.is_dynamic ?? data.isDynamic ?? false,
		is_password_protected: data.is_password_protected ?? data.isPasswordProtected ?? false,
		expires_at: data.expires_at || data.expiresAt || null,
		tags: data.tags || [],
		campaign_id: data.campaign_id || data.campaignId || null,
		campaign_name: data.campaign_name || data.campaignName || null,

		geo__country: geo.country || data.country || '',
		geo__country_code: geo.country_code || data.country_code || '',
		geo__region: geo.region || data.region || '',
		geo__city: geo.city || data.city || '',
		geo__timezone: geo.timezone || data.timezone || '',

		device__device_type: device.device_type || data.device_type || '',
		device__device_brand: device.device_brand || data.device_brand || '',
		device__device_model: device.device_model || data.device_model || '',
		device__browser: device.browser || data.browser || '',
		device__browser_version: device.browser_version || data.browser_version || '',
		device__os: device.os || data.os || '',
		device__os_version: device.os_version || data.os_version || '',
		device__os_platform: device.os_platform || data.os_platform || '',

		traffic__traffic_source: traffic.traffic_source || data.traffic_source || '',
		traffic__traffic_medium: traffic.traffic_medium || data.traffic_medium || '',
		traffic__organic_vs_paid: traffic.organic_vs_paid || data.organic_vs_paid || '',
		traffic__referer: traffic.referer || data.referer || data.referrer || data.referrer_url || '',
		traffic__referrer_domain: traffic.referrer_domain || data.referrer_domain || ''
	};

	if (includeUnique) {
		result.is_unique = data.is_unique ?? true;
	}

	return result;
}
