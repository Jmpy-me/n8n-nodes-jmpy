import {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
	INodePropertyOptions,
	ILoadOptionsFunctions,
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

	// 2. Extract QR Details if present
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

function evaluateFilters(item: any, campaignIds: string[], urlType: string[], brandedDomain: string[], subdomain: string[], filtersObj: any): boolean {
	// Campaign filter
	const activeCampaignIds = (campaignIds || []).filter(Boolean);
	if (activeCampaignIds.length > 0) {
		const itemCampaignId = item.campaign_id || item.campaignId;
		if (!activeCampaignIds.includes(itemCampaignId)) return false;
	}

	// Link type filter
	const activeUrlTypes = (urlType || []).filter(Boolean);
	if (activeUrlTypes.length > 0) {
		let itemType = item.url_type || item.link_branding;
		if (!itemType) {
			if (item.subdomain) {
				itemType = 'subdomain';
			} else if (item.branded_domain || item.brandedDomain || item.domain) {
				itemType = 'branded';
			} else {
				itemType = 'standard';
			}
		}
		if (!activeUrlTypes.includes(itemType)) return false;
	}

	// Branded domain filter
	const activeBranded = (brandedDomain || []).filter(Boolean);
	if (activeBranded.length > 0) {
		const itemDomain = item.branded_domain || item.brandedDomain || item.domain || '';
		if (!activeBranded.map(d => d.toLowerCase()).includes(itemDomain.toLowerCase())) return false;
	}

	// Subdomain filter
	const activeSub = (subdomain || []).filter(Boolean);
	if (activeSub.length > 0) {
		const itemSubdomain = item.subdomain || '';
		if (!activeSub.map(s => s.toLowerCase()).includes(itemSubdomain.toLowerCase())) return false;
	}

	// Dynamic filters
	if (filtersObj && typeof filtersObj === 'object' && Object.keys(filtersObj).length > 0) {
		for (const [key, val] of Object.entries(filtersObj)) {
			if (val === undefined || val === null || val === '') continue;

			if (key === 'is_expiring') {
				const expiresVal = item.expires_at || item.expiresAt;
				const hasExpiration = expiresVal !== null && expiresVal !== undefined && expiresVal !== '';
				if (hasExpiration !== val) return false;
			} else if (key === 'only_with_tags') {
				const hasTags = Array.isArray(item.tags) && item.tags.length > 0;
				if (hasTags !== val) return false;
			} else if (key === 'tags') {
				const filterTags = Array.isArray(val) ? val : String(val).split(',').map(t => t.trim()).filter(Boolean);
				const payloadTags = Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(',').map(t => t.trim()).filter(Boolean) : []);
				if (filterTags.length > 0 && !filterTags.every(t => payloadTags.includes(t))) {
					return false;
				}
			} else {
				const itemVal = item[key];
				if (typeof val === 'boolean') {
					if (Boolean(itemVal) !== val) return false;
				} else {
					if (String(itemVal).toLowerCase() !== String(val).toLowerCase()) return false;
				}
			}
		}
	}

	return true;
}

export class JmpyPollingTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Jmpy.me Polling Trigger',
		name: 'jmpyPollingTrigger',
		icon: 'file:logo.png',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Triggers on a schedule when new short URLs or QR codes are created in Jmpy.me (works for all plan levels)',
		defaults: {
			name: 'Jmpy.me Polling Trigger',
		},
		polling: true,
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'jmpyOAuth2Api',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				default: 'newShortUrl',
				options: [
					{
						name: 'New Short URL Created',
						value: 'newShortUrl',
						description: 'Triggers when a new short URL is created (polled)',
					},
					{
						name: 'New QR Code Created',
						value: 'newQrCode',
						description: 'Triggers when a new QR code is generated (polled)',
					},
					{
						name: 'New Link Click',
						value: 'newLinkClick',
						description: 'Triggers when a short URL is clicked (polled)',
					},
					{
						name: 'New Link Click (Unique)',
						value: 'newLinkClickUnique',
						description: 'Triggers when a short URL receives a unique click (polled)',
					},
					{
						name: 'New Link Click (with UTM)',
						value: 'newLinkClickUtm',
						description: 'Triggers when a short URL is clicked with UTM parameters (polled)',
					},
					{
						name: 'New QR Code Scan',
						value: 'newQrCodeScan',
						description: 'Triggers when a QR code is scanned (polled)',
					},
					{
						name: 'New QR Code Scan (Unique)',
						value: 'newQrCodeScanUnique',
						description: 'Triggers when a QR code receives a unique scan (polled)',
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
							'newLinkClick',
							'newLinkClickUnique',
							'newLinkClickUtm',
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
							'newLinkClick',
							'newLinkClickUnique',
							'newLinkClickUtm',
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
							'newLinkClick',
							'newLinkClickUnique',
							'newLinkClickUtm',
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
							'newQrCodeScan',
							'newQrCodeScanUnique',
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
							'newQrCodeScan',
							'newQrCodeScanUnique',
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
							'newQrCodeScan',
							'newQrCodeScanUnique',
						],
						qrCodeSelectionMode: [
							'manual',
						],
					},
				},
			},
			// Campaign filter
			{
				displayName: 'Campaign Name or ID',
				name: 'campaignId',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getCampaigns',
				},
				default: [],
				required: false,
				description: 'Select one or more campaigns to filter by. Only events for URLs/QRs inside these campaigns will trigger. Leave empty to match all.',
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
							'newShortUrl',
							'newLinkClick',
							'newLinkClickUnique',
							'newLinkClickUtm',
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
							'newQrCode',
							'newQrCodeScan',
							'newQrCodeScanUnique',
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
									'newQrCode',
									'newQrCodeScan',
									'newQrCodeScanUnique',
								],
							},
						},
						description: 'Only trigger if the link/QR code contains all these specified tags. Separate tags with commas. Use case: filter by custom tag categories.',
					},
					{
						displayName: 'Only with Tags',
						name: 'only_with_tags',
						type: 'boolean',
						default: false,
						displayOptions: {
							hide: {
								'/event': [
									'newQrCode',
									'newQrCodeScan',
									'newQrCodeScanUnique',
								],
							},
						},
						description: 'Whether to only trigger for URLs that have one or more tags assigned.',
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
						displayOptions: {
							hide: {
								'/event': [
									'newQrCode',
									'newQrCodeScan',
									'newQrCodeScanUnique',
								],
							},
						},
						description: 'Only trigger for links with a custom short code alias instead of a randomly generated one.',
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
						body: { limit: 100, sortBy: 'created_at', sortOrder: 'desc', tracked: 'true', is_polling: true },
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

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const webhookData = this.getWorkflowStaticData('node');

		let campaignIds: string[] = [];
		try {
			const rawCampaignIds = this.getNodeParameter('campaignId') as any;
			if (typeof rawCampaignIds === 'string') {
				campaignIds = rawCampaignIds.split(',').map((c: string) => c.trim()).filter(Boolean);
			} else if (Array.isArray(rawCampaignIds)) {
				campaignIds = rawCampaignIds.flatMap((c: any) => typeof c === 'string' ? c.split(',').map((x: string) => x.trim()) : [c]).map((c: any) => String(c)).filter(Boolean);
			}
		} catch (e) {}

		let urlType: string[] = [];
		try {
			urlType = this.getNodeParameter('url_type') as string[];
		} catch (e) {}

		let brandedDomain: string[] = [];
		try {
			brandedDomain = this.getNodeParameter('branded_domain') as string[];
		} catch (e) {}

		let subdomain: string[] = [];
		try {
			subdomain = this.getNodeParameter('subdomain') as string[];
		} catch (e) {}

		let filtersObj: any = {};
		try {
			filtersObj = this.getNodeParameter('filters') as any;
		} catch (e) {}

		// Get the last processed timestamp
		const lastTimeChecked = webhookData.lastTimeChecked as string;

		let isManualMode = false;
		try {
			isManualMode = this.getMode() === 'manual';
		} catch (e) {}

		const makeApiRequest = async (url: string, body: any) => {
			try {
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
					method: 'POST',
					url,
					body,
					json: true,
					returnFullResponse: true,
					ignoreHttpStatusErrors: true,
				});

				const statusCode = response.statusCode || response.status || 200;
				if (statusCode >= 400) {
					const responseBody = response.body || response;
					let errorMessage = 'Failed to fetch polling data';
					
					if (responseBody && typeof responseBody === 'object') {
						errorMessage = responseBody.error || responseBody.detail || responseBody.message || errorMessage;
					} else if (typeof responseBody === 'string') {
						try {
							const parsed = JSON.parse(responseBody);
							errorMessage = parsed.error || parsed.detail || parsed.message || errorMessage;
						} catch (e) {
							errorMessage = responseBody || errorMessage;
						}
					}
					
					throw new NodeOperationError(this.getNode(), errorMessage);
				}

				return response.body || response;
			} catch (error: any) {
				if (error instanceof NodeOperationError) throw error;
				const apiErr = error?.error?.error || error?.response?.data?.error || error?.response?.data?.message || error?.message;
				if (apiErr && typeof apiErr === 'string') {
					throw new NodeOperationError(this.getNode(), apiErr);
				}
				throw new NodeApiError(this.getNode(), error);
			}
		};

		if (event === 'newShortUrl') {
			const apiFilters: any = {
				sortBy: 'created_at',
				sortOrder: 'desc',
				limit: 100,
				is_polling: true,
			};

			const activeUrlTypes = (urlType || []).filter(Boolean);
			if (activeUrlTypes.length === 1) {
				apiFilters.urlType = activeUrlTypes[0];
			}
			if (campaignIds && campaignIds.length > 0) {
				apiFilters.campaignId = campaignIds.join(',');
			}
			if (filtersObj) {
				if (filtersObj.custom_alias !== undefined && filtersObj.custom_alias !== null && filtersObj.custom_alias !== '') {
					apiFilters.alias = filtersObj.custom_alias;
				}
				if (filtersObj.is_dynamic !== undefined && filtersObj.is_dynamic !== null && filtersObj.is_dynamic !== '') {
					apiFilters.isDynamic = filtersObj.is_dynamic;
				}
				if (filtersObj.is_password_protected !== undefined && filtersObj.is_password_protected !== null && filtersObj.is_password_protected !== '') {
					apiFilters.passwordProtected = filtersObj.is_password_protected;
				}
				if (filtersObj.is_expiring !== undefined && filtersObj.is_expiring !== null && filtersObj.is_expiring !== '') {
					apiFilters.expiring = filtersObj.is_expiring ? 'yes' : 'no';
				}
				if (filtersObj.has_utm_params !== undefined && filtersObj.has_utm_params !== null && filtersObj.has_utm_params !== '') {
					apiFilters.utm = filtersObj.has_utm_params ? 'yes' : 'no';
				}
				if (filtersObj.tags) {
					apiFilters.tags = filtersObj.tags;
				}
				if (filtersObj.only_with_tags !== undefined && filtersObj.only_with_tags !== null && filtersObj.only_with_tags !== '') {
					apiFilters.hasTags = filtersObj.only_with_tags;
				}
			}

			const responseData = await makeApiRequest(`${API_BASE_URL}/mcp/execute/listUrls`, apiFilters);

			const data = parseMcpResponse(responseData);
			let urls: any[] = [];

			if (data && Array.isArray(data.shortUrls)) {
				urls = data.shortUrls;
			} else if (data && Array.isArray(data.urls)) {
				urls = data.urls;
			} else if (Array.isArray(data)) {
				urls = data;
			}

			// Filter by user selection filters
			urls = urls.filter((u: any) => evaluateFilters(u, campaignIds, urlType, brandedDomain, subdomain, filtersObj));

			// Filter to only new items since last check
			if (lastTimeChecked && !isManualMode) {
				const lastTime = new Date(lastTimeChecked).getTime();
				urls = urls.filter((u: any) => {
					const createdAt = new Date(u.created_at || u.createdAt).getTime();
					return createdAt > lastTime;
				});
			}

			// Update last checked time
			if (!isManualMode) {
				if (urls.length > 0) {
					const newestDate = urls.reduce((latest: string, u: any) => {
						const d = u.created_at || u.createdAt;
						return d > latest ? d : latest;
					}, urls[0].created_at || urls[0].createdAt);
					webhookData.lastTimeChecked = newestDate;
				} else if (!lastTimeChecked) {
					webhookData.lastTimeChecked = new Date().toISOString();
				}
			}

			if (urls.length === 0) {
				return null;
			}

			const formattedUrls = urls.map((u: any) => {
				const cleaned = cleanResponseData({ ...u });
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
					result.qr_code_excel_sheet_formula_IMAGE = cleaned.qr_code_excel_sheet_formula_IMAGE || cleaned.qr_code_url;
				}

				if (cleaned.safety_status && cleaned.safety_status !== 'safe') {
					result.safety_status = cleaned.safety_status;
				}
				
				return { json: result };
			});

			return [formattedUrls];
		}

		if (event === 'newQrCode') {
			const apiFilters: any = {
				sortBy: 'created_at',
				sortOrder: 'desc',
				limit: 100,
				is_polling: true,
			};

			const activeUrlTypes = (urlType || []).filter(Boolean);
			if (activeUrlTypes.length === 1) {
				apiFilters.urlType = activeUrlTypes[0];
			}
			if (campaignIds && campaignIds.length > 0) {
				apiFilters.campaignId = campaignIds.join(',');
			}

			const responseData = await makeApiRequest(`${API_BASE_URL}/mcp/execute/listQrCodes`, apiFilters);

			const data = parseMcpResponse(responseData);
			let qrCodes: any[] = [];

			if (data && Array.isArray(data.qrCodes)) {
				qrCodes = data.qrCodes;
			} else if (Array.isArray(data)) {
				qrCodes = data;
			}

			// Filter by user selection filters
			qrCodes = qrCodes.filter((q: any) => evaluateFilters(q, campaignIds, urlType, brandedDomain, subdomain, filtersObj));

			// Filter to only new items since last check
			if (lastTimeChecked && !isManualMode) {
				const lastTime = new Date(lastTimeChecked).getTime();
				qrCodes = qrCodes.filter((q: any) => {
					const createdAt = new Date(q.created_at || q.createdAt).getTime();
					return createdAt > lastTime;
				});
			}

			// Update last checked time
			if (!isManualMode) {
				if (qrCodes.length > 0) {
					const newestDate = qrCodes.reduce((latest: string, q: any) => {
						const d = q.created_at || q.createdAt;
						return d > latest ? d : latest;
					}, qrCodes[0].created_at || qrCodes[0].createdAt);
					webhookData.lastTimeChecked = newestDate;
				} else if (!lastTimeChecked) {
					webhookData.lastTimeChecked = new Date().toISOString();
				}
			}

			if (qrCodes.length === 0) {
				return null;
			}

			const formattedQrCodes = qrCodes.map((q: any) => {
				const cleaned = cleanResponseData({ ...q });

				let contentUrl = q.short_url || '';
				if (!contentUrl && q.content_data) {
					if (typeof q.content_data === 'string') {
						contentUrl = q.content_data;
					} else if (q.content_data.url) {
						contentUrl = q.content_data.url;
					} else if (q.content_data.text) {
						contentUrl = q.content_data.text;
					}
				}

				return {
					json: {
						name: cleaned.name || '',
						content_type: cleaned.content_type || '',
						content_url: contentUrl,
						qr_code_url: cleaned.qr_code_url || '',
						qr_code_html: cleaned.qr_code_html || '',
						qr_code_excel_sheet_formula: cleaned.qr_code_excel_sheet_formula || '',
						is_password_protected: cleaned.is_password_protected ?? false,
						expires_at: cleaned.expires_at || null,
						is_dynamic: cleaned.is_dynamic ?? false,
						tracking_enabled: cleaned.tracking_enabled ?? true,
						created_at: cleaned.created_at || new Date().toISOString(),
						qr_code_excel_sheet_formula_IMAGE: cleaned.qr_code_excel_sheet_formula_IMAGE || '',
						qr_code_id: cleaned.qr_code_id || '',
						link_branding: cleaned.link_branding || cleaned.branded || 'no',
						utm_source: cleaned.utm_source || null,
						utm_medium: cleaned.utm_medium || null,
						utm_campaign: cleaned.utm_campaign || null,
						utm_term: cleaned.utm_term || null,
						utm_content: cleaned.utm_content || null,
						has_utm_params: cleaned.has_utm_params ?? false,
						campaign_id: cleaned.campaign_id || cleaned.campaignId || null,
						campaign_name: cleaned.campaign_name || cleaned.campaignName || null,
					}
				};
			});

			return [formattedQrCodes];
		}

		if (event === 'newLinkClick' || event === 'newLinkClickUnique' || event === 'newLinkClickUtm') {
			let shortCodes: string[] = [];
			try {
				const mode = this.getNodeParameter('shortCodeSelectionMode', '') as string;
				if (mode === 'list') {
					const listCodes = this.getNodeParameter('shortCodes', []) as string[];
					if (listCodes && listCodes.length > 0) {
						shortCodes = listCodes;
					}
				} else {
					const customStr = this.getNodeParameter('customShortCodes', '') as string;
					if (customStr) {
						shortCodes = customStr.split(',').map(s => s.trim()).filter(Boolean);
					}
				}
			} catch (e) {
				// Fallback
			}

			const clickFilters: any = {
				shortCodes: shortCodes.join(','),
				limit: 20,
				is_polling: true,
			};
			const activeUrlTypes = (urlType || []).filter(Boolean);
			if (activeUrlTypes.length === 1) {
				clickFilters.urlType = activeUrlTypes[0];
			}
			if (campaignIds && campaignIds.length > 0) {
				clickFilters.campaignId = campaignIds.join(',');
			}
			if (brandedDomain && brandedDomain.length > 0) {
				clickFilters.brandedDomain = brandedDomain.join(',');
			}
			if (subdomain && subdomain.length > 0) {
				clickFilters.subdomain = subdomain.join(',');
			}

			if (filtersObj) {
				if (filtersObj.custom_alias !== undefined && filtersObj.custom_alias !== null && filtersObj.custom_alias !== '') {
					clickFilters.custom_alias = filtersObj.custom_alias;
				}
				if (filtersObj.is_dynamic !== undefined && filtersObj.is_dynamic !== null && filtersObj.is_dynamic !== '') {
					clickFilters.isDynamic = filtersObj.is_dynamic;
				}
				if (filtersObj.is_password_protected !== undefined && filtersObj.is_password_protected !== null && filtersObj.is_password_protected !== '') {
					clickFilters.isPasswordProtected = filtersObj.is_password_protected;
				}
				if (filtersObj.is_expiring !== undefined && filtersObj.is_expiring !== null && filtersObj.is_expiring !== '') {
					clickFilters.isExpiring = filtersObj.is_expiring;
				}
				if (filtersObj.has_utm_params !== undefined && filtersObj.has_utm_params !== null && filtersObj.has_utm_params !== '') {
					clickFilters.hasUtm = filtersObj.has_utm_params;
				}
				if (filtersObj.tags) {
					clickFilters.tags = filtersObj.tags;
				}
			}

			const responseData = await makeApiRequest(`${API_BASE_URL}/mcp/execute/getUrlClickLogs`, clickFilters);

			const data = parseMcpResponse(responseData);
			let clicks: any[] = [];

			if (Array.isArray(data)) {
				clicks = data;
			} else if (data && Array.isArray(data.data)) {
				clicks = data.data;
			} else if (data && Array.isArray(data.clicks)) {
				clicks = data.clicks;
			}

			// Apply campaign filtering locally to ensure consistent results
			const activeCampaignIds = (campaignIds || []).filter(Boolean);
			if (activeCampaignIds.length > 0) {
				clicks = clicks.filter((c: any) => {
					const itemCampaignId = c.campaign_id || c.campaignId;
					return activeCampaignIds.includes(itemCampaignId);
				});
			}

			// Filter to only new items since last check, and apply event-specific filters
			if (lastTimeChecked && !isManualMode) {
				const lastTime = new Date(lastTimeChecked).getTime();
				clicks = clicks.filter((c: any) => {
					const clickedAt = new Date(c.clicked_at || c.clickedAt).getTime();
					if (clickedAt <= lastTime) return false;

					if (event === 'newLinkClickUtm') {
						if (!c.utm_source && !c.utm_medium && !c.utm_campaign && !c.utm_term && !c.utm_content) return false;
					}

					return true;
				});
			} else {
				if (event === 'newLinkClickUtm') {
					clicks = clicks.filter((c: any) => (c.utm_source || c.utm_medium || c.utm_campaign || c.utm_term || c.utm_content));
				}
			}


			if (event === 'newLinkClickUnique') {
				let seenUnique = webhookData.seenUnique as Record<string, boolean>;
				if (!seenUnique) {
					seenUnique = {};
					webhookData.seenUnique = seenUnique;
				}
				
				clicks = clicks.filter((c: any) => {
					if (!c.ip_address) return true;
					const key = `${c.ip_address}_${c.short_code}`;
					if (seenUnique[key]) return false;
					seenUnique[key] = true;
					return true;
				});
			}


			// Update last checked time
			if (!isManualMode) {
				if (clicks.length > 0) {
					const newestDate = clicks.reduce((latest: string, c: any) => {
						const d = c.clicked_at || c.clickedAt;
						return d > latest ? d : latest;
					}, clicks[0].clicked_at || clicks[0].clickedAt);
					webhookData.lastTimeChecked = newestDate;
				} else if (!lastTimeChecked) {
					webhookData.lastTimeChecked = new Date().toISOString();
				}
			}

			if (clicks.length === 0) {
				return null;
			}
			const formattedClicks = clicks.map((c: any) => {
				const data = { ...c };
				const includeUnique = event.includes('Unique');
				const isQr = data.is_qr_scan === true || data.is_qr_scan === 'true' || !!data.scan_id || data.interaction_type === 'qr_scan';
				const rawId = data.click_id || data.scan_id || data.interaction_id || data.id || '';

				if (event === 'newLinkClickUtm') {
					return {
						json: {
							id: rawId,
							interaction_id: rawId,
							interaction_type: isQr ? 'qr_scan' : 'click',
							click_id: isQr ? null : rawId,
							scan_id: isQr ? rawId : null,
							click_detail: isQr ? 'qr_scan' : 'click',
							short_id: data.short_id || data.short_url_id || data.short_code_id || data.link_id || '',
							clicked_at: data.clicked_at || data.clickedAt || new Date().toISOString(),
							destination_url: data.original_url || data.destination_url || '',
							short_code: data.short_code || '',
							short_url: data.short_url || (data.branded_domain ? `https://${data.branded_domain}/${data.custom_alias || data.short_code}` : (data.subdomain ? `https://${data.subdomain}.jmpy.me/${data.custom_alias || data.short_code}` : (data.short_code ? `https://jmpy.me/${data.short_code}` : ''))),
							utm_source: data.utm?.utm_source || data.utm_source || null,
							utm_medium: data.utm?.utm_medium || data.utm_medium || null,
							utm_campaign: data.utm?.utm_campaign || data.utm_campaign || null,
							utm_term: data.utm?.utm_term || data.utm_term || null,
							utm_content: data.utm?.utm_content || data.utm_content || null,
							campaign_id: data.campaign_id || data.campaignId || '',
							campaign_name: data.campaign_name || data.campaignName || '',
						}
					};
				}

				const result: any = {
					id: rawId,
					interaction_id: rawId,
					interaction_type: isQr ? 'qr_scan' : 'click',
					click_id: isQr ? null : rawId,
					scan_id: isQr ? rawId : null,
					click_detail: isQr ? 'qr_scan' : 'click',
					short_id: data.short_id || data.short_url_id || data.short_code_id || data.link_id || '',
					short_code: data.short_code || '',
					short_url: data.short_url || (data.branded_domain ? `https://${data.branded_domain}/${data.custom_alias || data.short_code}` : (data.subdomain ? `https://${data.subdomain}.jmpy.me/${data.custom_alias || data.short_code}` : (data.short_code ? `https://jmpy.me/${data.short_code}` : ''))),
					destination_url: data.original_url || data.destination_url || '',
					clicked_at: data.clicked_at || data.clickedAt || new Date().toISOString(),
					campaign_id: data.campaign_id || data.campaignId || '',
					campaign_name: data.campaign_name || data.campaignName || '',
				};

				if (includeUnique) {
					result.is_unique = data.is_unique ?? true;
				}

				result.country = data.country || data.geo?.country || '';
				result.country_code = data.country_code || data.geo?.country_code || '';
				result.region = data.region || data.geo?.region || '';
				result.city = data.city || data.geo?.city || '';
				result.timezone = data.timezone || data.geo?.timezone || '';

				result.device_type = data.device_type || data.device?.device_type || '';
				result.device_brand = data.device_brand || data.device?.device_brand || '';
				result.device_model = data.device_model || data.device?.device_model || '';
				result.browser = data.browser || data.device?.browser || '';
				result.browser_version = data.browser_version || data.device?.browser_version || '';
				result.os = data.os || data.device?.os || '';
				result.os_version = data.os_version || data.device?.os_version || '';

				result.traffic_source = data.traffic_source || data.traffic?.traffic_source || '';
				result.traffic_medium = data.traffic_medium || data.traffic?.traffic_medium || '';
				result.referer = data.referrer || data.referer || data.traffic?.referer || '';
				result.referrer_domain = data.referrer_domain || data.traffic?.referrer_domain || '';

				result.utm_source = data.utm_source || data.utm?.utm_source || '';
				result.utm_medium = data.utm_medium || data.utm?.utm_medium || '';
				result.utm_campaign = data.utm_campaign || data.utm?.utm_campaign || '';
				result.utm_term = data.utm_term || data.utm?.utm_term || '';
				result.utm_content = data.utm_content || data.utm?.utm_content || '';

				return { json: result };
			});

			return [formattedClicks];
		}

		if (event === 'newQrCodeScan' || event === 'newQrCodeScanUnique') {
			let qrCodeIds: string[] = [];
			try {
				const mode = this.getNodeParameter('qrCodeSelectionMode', '') as string;
				if (mode === 'list') {
					const listIds = this.getNodeParameter('qrCodeIds', []) as string[];
					if (listIds && listIds.length > 0) {
						qrCodeIds = listIds;
					}
				} else {
					const customStr = this.getNodeParameter('customQrCodeIds', '') as string;
					if (customStr) {
						qrCodeIds = customStr.split(',').map(s => s.trim()).filter(Boolean);
					}
				}
			} catch (e) {
				// Fallback
			}

			let responseData;
			try {
				responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
					method: 'GET',
					url: `${API_BASE_URL}/api/v1/qranalytics/recent`,
					qs: {
						limit: 20,
					},
					headers: {
						'Content-Type': 'application/json'
					},
					body: {
						is_polling: true,
					},
					json: true,
				});
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as any);
			}

			const data = parseMcpResponse(responseData);
			let scans: any[] = [];

			if (Array.isArray(data)) {
				scans = data;
			}

			// Apply filters
			scans = scans.filter((s: any) => {
				if (qrCodeIds.length > 0 && !qrCodeIds.includes(s.qrId || s.qr_code_id)) return false;
				if (event === 'newQrCodeScanUnique' && !(s.isUnique === true || s.is_unique === true)) return false;
				
				const activeCampaignIds = (campaignIds || []).filter(Boolean);
				if (activeCampaignIds.length > 0) {
					const itemCampaignId = s.campaign_id || s.campaignId;
					if (!activeCampaignIds.includes(itemCampaignId)) return false;
				}
				
				if (lastTimeChecked && !isManualMode) {
					const scannedAt = new Date(s.scannedAt || s.scanned_at).getTime();
					const lastTime = new Date(lastTimeChecked).getTime();
					if (scannedAt <= lastTime) return false;
				}
				
				return true;
			});

			// Update last checked time
			if (!isManualMode) {
				if (scans.length > 0) {
					const newestDate = scans.reduce((latest: string, s: any) => {
						const d = s.scannedAt || s.scanned_at;
						return d > latest ? d : latest;
					}, scans[0].scannedAt || scans[0].scanned_at);
					webhookData.lastTimeChecked = newestDate;
				} else if (!lastTimeChecked) {
					webhookData.lastTimeChecked = new Date().toISOString();
				}
			}

			if (scans.length === 0) {
				return null;
			}

			const formattedScans = scans.map((s: any) => {
				const data = { ...s };
				const includeUnique = event.includes('Unique');
				const result: any = {
					qr_code_id: data.qr_code_id || '',
					id: data.scan_id || data.id || '',
					qr_code_name: data.qr_code_name || '',
					content_type: data.content_type || 'url',
					qr_content: data.qr_content || '',
					scanned_at: data.scanned_at || data.scannedAt || new Date().toISOString(),
					campaign_id: data.campaign_id || data.campaignId || '',
					campaign_name: data.campaign_name || data.campaignName || '',
				};

				if (includeUnique) {
					result.is_unique = data.is_unique ?? true;
				}

				result.country = data.country || data.geo?.country || '';
				result.country_code = data.country_code || data.geo?.country_code || '';
				result.region = data.region || data.geo?.region || '';
				result.city = data.city || data.geo?.city || '';
				result.timezone = data.timezone || data.geo?.timezone || '';

				result.device_type = data.device_type || data.device?.device_type || '';
				result.device_brand = data.device_brand || data.device?.device_brand || '';
				result.device_model = data.device_model || data.device?.device_model || '';
				result.browser = data.browser || data.device?.browser || '';
				result.browser_version = data.browser_version || data.device?.browser_version || '';
				result.os = data.os || data.device?.os || '';
				result.os_version = data.os_version || data.device?.os_version || '';

				result.traffic_source = data.traffic_source || data.traffic?.traffic_source || '';
				result.traffic_medium = data.traffic_medium || data.traffic?.traffic_medium || '';
				result.referer = data.referrer || data.referer || data.traffic?.referer || '';
				result.referrer_domain = data.referrer_domain || data.traffic?.referrer_domain || '';

				return { json: result };
			});

			return [formattedScans];
		}

		return null;
	}
}
