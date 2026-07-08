import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	INodePropertyOptions,
	ILoadOptionsFunctions,
	NodeApiError,
} from 'n8n-workflow';

// Use the same ngrok base URL as the main node for dev
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
	'urlClickedUnique': 'link.clicked',
	'urlClickedUtm': 'link.clicked',
	// QR events
	'qrCreated': 'qr.created',
	'qrScanned': 'qr.scanned',
	'qrScannedUnique': 'qr.scanned',
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
			{
				displayName: 'Webhook Tunnel URL / Host Override',
				name: 'webhookTunnelUrl',
				type: 'string',
				default: '',
				required: false,
				placeholder: 'https://xxxx.ngrok-free.dev',
				description: 'If you access n8n via a tunnel (e.g. ngrok, Cloudflare) and get a localhost error, enter your public tunnel URL here to override the domain.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getShortUrls(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
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
					return [];
				}
			},
			async getQrCodes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
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
					return [];
				}
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				return webhookData.webhookId !== undefined;
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
				};

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

					throw new NodeApiError(this.getNode(), { message: errorMessage } as any, {
						message: errorMessage,
						description: errorDescription,
						httpCode: String(statusCode),
					});
				}

				const successBody = response.body || response;
				const responseData = successBody.data || successBody;
				if (!responseData || !responseData.id) {
					throw new Error('Failed to create webhook subscription');
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = responseData.id;
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
			return {
				workflowData: [
					this.helpers.returnJsonArray([formatUrlCreatedPayload(payload)]),
				],
			};
		}

		// QR created
		if (event === 'qrCreated') {
			return {
				workflowData: [
					this.helpers.returnJsonArray([formatQrCreatedPayload(payload)]),
				],
			};
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
		if (clickEvents.includes(event)) {
			if (event === 'urlClickedUtm') {
				return {
					workflowData: [
						this.helpers.returnJsonArray([formatClickUtmPayload(payload)]),
					],
				};
			}
			return {
				workflowData: [
					this.helpers.returnJsonArray([formatClickPayload(payload, event.includes('Unique'))]),
				],
			};
		}

		if (scanEvents.includes(event)) {
			return {
				workflowData: [
					this.helpers.returnJsonArray([formatScanPayload(payload, event.includes('Unique'))]),
				],
			};
		}

		// Fallback: return raw payload
		return {
			workflowData: [
				this.helpers.returnJsonArray([payload]),
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

	const rootDlUrl = obj.downloadUrl || obj.download_url || obj.qr_code_url || obj.qrCodeUrl;
	if (rootDlUrl && typeof rootDlUrl === 'string' && rootDlUrl.startsWith('http')) {
		obj.qr_code_url = rootDlUrl;
	}

	if (!obj.qr_code_url && obj.short_url && typeof obj.short_url === 'string') {
		obj.qr_code_url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(obj.short_url)}`;
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
			obj.qr_code_uuid = obj.id;
		} else {
			obj.short_code_id = obj.id;
		}
		delete obj.id;
	}

	const branding = obj.link_branding || obj.url_type;
	if (branding !== undefined) {
		if (branding === 'branded' || branding === 'subdomain') {
			obj.branded = 'yes';
		} else {
			obj.branded = 'no';
		}
	} else {
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
	return cleanResponseData({ ...data });
}

function formatQrCreatedPayload(data: any) {
	return cleanResponseData({ ...data });
}

function formatClickPayload(data: any, includeUnique: boolean = false) {
	const result: any = {
		id: data.id || data.click_id || 'click_sample_123',
		click_id: data.click_id || data.id || '',
		short_code: data.short_code || '',
		short_url: data.short_url || '',
		destination_url: data.original_url || data.destination_url || '',
		ip_address: data.ip_address || '',
		clicked_at: data.clicked_at || new Date().toISOString(),
	};

	if (includeUnique) {
		result.is_unique = data.is_unique ?? true;
	}

	if (data.geo) {
		result.country = data.geo.country || '';
		result.country_code = data.geo.country_code || '';
		result.region = data.geo.region || '';
		result.city = data.geo.city || '';
		result.timezone = data.geo.timezone || '';
	}

	if (data.device) {
		result.device_type = data.device.device_type || '';
		result.device_brand = data.device.device_brand || '';
		result.device_model = data.device.device_model || '';
		result.browser = data.device.browser || '';
		result.browser_version = data.device.browser_version || '';
		result.os = data.device.os || '';
		result.os_version = data.device.os_version || '';
	}

	if (data.traffic) {
		result.traffic_source = data.traffic.traffic_source || '';
		result.traffic_medium = data.traffic.traffic_medium || '';
		result.referer = data.traffic.referer || '';
		result.referrer_domain = data.traffic.referrer_domain || '';
	}

	if (data.utm) {
		result.utm_source = data.utm.utm_source || '';
		result.utm_medium = data.utm.utm_medium || '';
		result.utm_campaign = data.utm.utm_campaign || '';
		result.utm_term = data.utm.utm_term || '';
		result.utm_content = data.utm.utm_content || '';
	}

	return result;
}

function formatClickUtmPayload(data: any) {
	return {
		id: data.id || data.click_id || 'click_sample_123',
		click_id: data.click_id || data.id || '',
		clicked_at: data.clicked_at || new Date().toISOString(),
		destination_url: data.original_url || data.destination_url || '',
		short_code: data.short_code || '',
		short_url: data.short_url || '',
		utm_source: data.utm?.utm_source || null,
		utm_medium: data.utm?.utm_medium || null,
		utm_campaign: data.utm?.utm_campaign || null,
		utm_term: data.utm?.utm_term || null,
		utm_content: data.utm?.utm_content || null,
	};
}

function formatScanPayload(data: any, includeUnique: boolean = false) {
	const result: any = {
		id: data.id || data.scan_id || 'scan_sample_123',
		scan_id: data.scan_id || data.id || '',
		qr_code_id: data.qr_code_id || '',
		qr_code_name: data.qr_code_name || '',
		content_type: data.content_type || 'url',
		qr_content: data.qr_content || '',
		ip_address: data.ip_address || '',
		scanned_at: data.scanned_at || new Date().toISOString(),
	};

	if (includeUnique) {
		result.is_unique = data.is_unique ?? true;
	}

	if (data.geo) {
		result.country = data.geo.country || '';
		result.country_code = data.geo.country_code || '';
		result.region = data.geo.region || '';
		result.city = data.geo.city || '';
		result.timezone = data.geo.timezone || '';
	}

	if (data.device) {
		result.device_type = data.device.device_type || '';
		result.device_brand = data.device.device_brand || '';
		result.device_model = data.device.device_model || '';
		result.browser = data.device.browser || '';
		result.browser_version = data.device.browser_version || '';
		result.os = data.device.os || '';
		result.os_version = data.device.os_version || '';
	}

	if (data.traffic) {
		result.traffic_source = data.traffic.traffic_source || '';
		result.traffic_medium = data.traffic.traffic_medium || '';
		result.referer = data.traffic.referer || '';
		result.referrer_domain = data.traffic.referrer_domain || '';
	}

	return result;
}
