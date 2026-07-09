import {
	IExecuteFunctions,
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	INodePropertyOptions,
	ILoadOptionsFunctions,
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
		],
	};

	methods = {
		loadOptions: {
			async getShortUrls(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
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
					return [];
				}
			},
			async getQrCodes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/mcp/execute/listQrCodes`,
						body: { limit: 100, sortBy: 'created_at', sortOrder: 'desc', qrType: 'tracked', is_polling: true },
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

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const webhookData = this.getWorkflowStaticData('node');

		// Get the last processed timestamp
		const lastTimeChecked = webhookData.lastTimeChecked as string;

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
					
					throw new NodeApiError(this.getNode(), { message: errorMessage } as any, {
						message: errorMessage,
						description: errorMessage,
						httpCode: String(statusCode),
					});
				}

				return response.body || response;
			} catch (error: any) {
				throw error;
			}
		};

		if (event === 'newShortUrl') {
			const responseData = await makeApiRequest(`${API_BASE_URL}/mcp/execute/listUrls`, {
					sortBy: 'created_at',
					sortOrder: 'desc',
					limit: 20,
					is_polling: true,
				});

			const data = parseMcpResponse(responseData);
			let urls: any[] = [];

			if (data && Array.isArray(data.shortUrls)) {
				urls = data.shortUrls;
			} else if (data && Array.isArray(data.urls)) {
				urls = data.urls;
			} else if (Array.isArray(data)) {
				urls = data;
			}

			// Filter to only new items since last check
			if (lastTimeChecked) {
				const lastTime = new Date(lastTimeChecked).getTime();
				urls = urls.filter((u: any) => {
					const createdAt = new Date(u.created_at || u.createdAt).getTime();
					return createdAt > lastTime;
				});
			}

			// Update last checked time
			if (urls.length > 0) {
				const newestDate = urls.reduce((latest: string, u: any) => {
					const d = u.created_at || u.createdAt;
					return d > latest ? d : latest;
				}, urls[0].created_at || urls[0].createdAt);
				webhookData.lastTimeChecked = newestDate;
			} else if (!lastTimeChecked) {
				webhookData.lastTimeChecked = new Date().toISOString();
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
					source: cleaned.source || '',
					qr_code_url: cleaned.qr_code_url || '',
					qr_code_html: cleaned.qr_code_html || '',
					qr_code_excel_sheet_formula: cleaned.qr_code_excel_sheet_formula || '',
					qr_code_excel_sheet_formula_IMAGE: cleaned.qr_code_excel_sheet_formula_IMAGE || '',
					short_code_id: cleaned.short_code_id || cleaned.id || '',
					utm_source: cleaned.utm_source || null,
					utm_medium: cleaned.utm_medium || null,
					utm_campaign: cleaned.utm_campaign || null,
					utm_term: cleaned.utm_term || null,
					utm_content: cleaned.utm_content || null,
					branded: cleaned.branded || 'no',
					subdomain: cleaned.subdomain || null,
					branded_domain: cleaned.branded_domain || null,
					custom_alias: cleaned.custom_alias || null,
					tags: cleaned.tags || [],
					has_utm_params: cleaned.has_utm_params ?? false,
				};

				if (cleaned.safety_status && cleaned.safety_status !== 'safe') {
					result.safety_status = cleaned.safety_status;
					result.safety_reason = cleaned.safety_reason || '';
					result.safety_report = cleaned.safety_report || null;
				}
				
				return { json: result };
			});

			return [formattedUrls];
		}

		if (event === 'newQrCode') {
			const responseData = await makeApiRequest(`${API_BASE_URL}/mcp/execute/listQrCodes`, {
					sortBy: 'created_at',
					sortOrder: 'desc',
					limit: 20,
					is_polling: true,
				});

			const data = parseMcpResponse(responseData);
			let qrCodes: any[] = [];

			if (data && Array.isArray(data.qrCodes)) {
				qrCodes = data.qrCodes;
			} else if (Array.isArray(data)) {
				qrCodes = data;
			}

			// Filter to only new items since last check
			if (lastTimeChecked) {
				const lastTime = new Date(lastTimeChecked).getTime();
				qrCodes = qrCodes.filter((q: any) => {
					const createdAt = new Date(q.created_at || q.createdAt).getTime();
					return createdAt > lastTime;
				});
			}

			// Update last checked time
			if (qrCodes.length > 0) {
				const newestDate = qrCodes.reduce((latest: string, q: any) => {
					const d = q.created_at || q.createdAt;
					return d > latest ? d : latest;
				}, qrCodes[0].created_at || qrCodes[0].createdAt);
				webhookData.lastTimeChecked = newestDate;
			} else if (!lastTimeChecked) {
				webhookData.lastTimeChecked = new Date().toISOString();
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
						branded: cleaned.branded || 'no',
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

			const responseData = await makeApiRequest(`${API_BASE_URL}/mcp/execute/getUrlClickLogs`, {
					shortCodes: shortCodes.join(','),
					limit: 20,
					is_polling: true,
				});

			const data = parseMcpResponse(responseData);
			let clicks: any[] = [];

			if (Array.isArray(data)) {
				clicks = data;
			} else if (data && Array.isArray(data.data)) {
				clicks = data.data;
			} else if (data && Array.isArray(data.clicks)) {
				clicks = data.clicks;
			}

			// Filter to only new items since last check, and apply event-specific filters
			if (lastTimeChecked) {
				const lastTime = new Date(lastTimeChecked).getTime();
				clicks = clicks.filter((c: any) => {
					const clickedAt = new Date(c.clicked_at || c.clickedAt).getTime();
					if (clickedAt <= lastTime) return false;
					if (c.is_qr_scan) return false; // exclude QR scans for link clicks

					if (event === 'newLinkClickUtm') {
						if (!c.utm_source && !c.utm_medium && !c.utm_campaign && !c.utm_term && !c.utm_content) return false;
					}

					return true;
				});
			} else {
				clicks = clicks.filter((c: any) => !c.is_qr_scan);
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
			if (clicks.length > 0) {
				const newestDate = clicks.reduce((latest: string, c: any) => {
					const d = c.clicked_at || c.clickedAt;
					return d > latest ? d : latest;
				}, clicks[0].clicked_at || clicks[0].clickedAt);
				webhookData.lastTimeChecked = newestDate;
			} else if (!lastTimeChecked) {
				webhookData.lastTimeChecked = new Date().toISOString();
			}

			if (clicks.length === 0) {
				return null;
			}

			const formattedClicks = clicks.map((c: any) => {
				const data = cleanResponseData({ ...c });
				const includeUnique = event.includes('Unique');
				
				if (event === 'newLinkClickUtm') {
					return {
						json: {
							click_id: data.click_id || data.id || '',
							short_id: data.short_id || data.short_url_id || data.short_code_id || data.link_id || '',
							clicked_at: data.clicked_at || data.clickedAt || new Date().toISOString(),
							destination_url: data.original_url || data.destination_url || '',
							short_code: data.short_code || '',
							short_url: data.short_url || (data.branded_domain ? `https://${data.branded_domain}/${data.custom_alias || data.short_code}` : (data.subdomain ? `https://${data.subdomain}.jmpy.me/${data.custom_alias || data.short_code}` : (data.short_code ? `https://jmpy.me/${data.short_code}` : ''))),
							utm_source: data.utm_source || data.utm?.utm_source || null,
							utm_medium: data.utm_medium || data.utm?.utm_medium || null,
							utm_campaign: data.utm_campaign || data.utm?.utm_campaign || null,
							utm_term: data.utm_term || data.utm?.utm_term || null,
							utm_content: data.utm_content || data.utm?.utm_content || null,
						}
					};
				}

				const result: any = {
					click_id: data.click_id || data.id || '',
					short_id: data.short_id || data.short_url_id || data.short_code_id || data.link_id || '',
					short_code: data.short_code || '',
					short_url: data.short_url || (data.branded_domain ? `https://${data.branded_domain}/${data.custom_alias || data.short_code}` : (data.subdomain ? `https://${data.subdomain}.jmpy.me/${data.custom_alias || data.short_code}` : (data.short_code ? `https://jmpy.me/${data.short_code}` : ''))),
					destination_url: data.original_url || data.destination_url || '',
					ip_address: data.ip_address || '',
					clicked_at: data.clicked_at || data.clickedAt || new Date().toISOString(),
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

			const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
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

			const data = parseMcpResponse(responseData);
			let scans: any[] = [];

			if (Array.isArray(data)) {
				scans = data;
			}

			// Apply filters
			scans = scans.filter((s: any) => {
				if (qrCodeIds.length > 0 && !qrCodeIds.includes(s.qrId || s.qr_code_id)) return false;
				if (event === 'newQrCodeScanUnique' && !(s.isUnique === true || s.is_unique === true)) return false;
				
				if (lastTimeChecked) {
					const scannedAt = new Date(s.scannedAt || s.scanned_at).getTime();
					const lastTime = new Date(lastTimeChecked).getTime();
					if (scannedAt <= lastTime) return false;
				}
				
				return true;
			});

			// Update last checked time
			if (scans.length > 0) {
				const newestDate = scans.reduce((latest: string, s: any) => {
					const d = s.scannedAt || s.scanned_at;
					return d > latest ? d : latest;
				}, scans[0].scannedAt || scans[0].scanned_at);
				webhookData.lastTimeChecked = newestDate;
			} else if (!lastTimeChecked) {
				webhookData.lastTimeChecked = new Date().toISOString();
			}

			if (scans.length === 0) {
				return null;
			}

			const formattedScans = scans.map((s: any) => {
				const data = cleanResponseData({ ...s });
				const includeUnique = event.includes('Unique');
				const result: any = {
					qr_code_id: data.qr_code_id || '',
					id: data.scan_id || data.id || '',
					qr_code_name: data.qr_code_name || '',
					content_type: data.content_type || 'url',
					qr_content: data.qr_content || '',
					ip_address: data.ip_address || '',
					scanned_at: data.scanned_at || data.scannedAt || new Date().toISOString(),
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
