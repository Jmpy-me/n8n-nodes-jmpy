import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

import { urlOperations, urlFields } from './UrlDescription';
import { qrOperations, qrFields } from './QrDescription';
import { campaignOperations, campaignFields } from './CampaignDescription';

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

function cleanObject(obj: any): any {
	const cleaned: any = {};
	for (const key of Object.keys(obj)) {
		if (obj[key] !== '' && obj[key] !== null && obj[key] !== undefined) {
			cleaned[key] = obj[key];
		}
	}
	return cleaned;
}

function cleanResponseData(obj: any): any {
	if (!obj || typeof obj !== 'object') return obj;

	if (Array.isArray(obj)) {
		return obj.map((item: any) => cleanResponseData(item));
	}

	// 1. Extract list of URLs and QR codes if nested
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

	if (!obj.campaign_name && obj.campaignName) {
		obj.campaign_name = obj.campaignName;
	} else if (!obj.campaign_name && obj.campaign && typeof obj.campaign === 'object' && obj.campaign.name) {
		obj.campaign_name = obj.campaign.name;
	}

	if (obj.qr_code_url && typeof obj.qr_code_url === 'string') {
		obj.qr_code_html = `<img src="${obj.qr_code_url}" alt="QR Code" width="200" height="200" />`;
		obj.qr_code_excel_sheet_formula = `=IMAGE("${obj.qr_code_url}")`;
	}


	// 3. Delete unwanted keys
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
		'click_count', 'clickCount',
		'qr_code_excel_sheet_formula_IMAGE',
		'metadata',
		'user_id', 'userId'
	];
	if (isSafe) {
		keysToDelete.push('safety_status', 'safetyStatus', 'safety_reason', 'safetyReason', 'safety_report', 'safetyReport');
	} else {
		keysToDelete.push('safety_reason', 'safetyReason', 'safety_report', 'safetyReport');
	}
	keysToDelete.forEach(k => {
		delete obj[k];
	});

	// 4. Rename keys
	if (obj.original_url !== undefined) {
		obj.destination_url = obj.original_url;
		delete obj.original_url;
	}
	if (obj.url_type !== undefined) {
		obj.link_branding = obj.url_type;
		delete obj.url_type;
	}

	const isQrCodeObj = obj.content_type !== undefined || obj.qr_content !== undefined || obj.visual_settings !== undefined || obj.qr_code_id !== undefined;
	if (obj.id !== undefined) {
		if (isQrCodeObj) {
			obj.qr_code_id = obj.id;
		} else {
			obj.short_code_id = obj.id;
		}
		delete obj.id;
	}

	const branding = obj.link_branding || obj.url_type || obj.qr_link_branding;
	if (isQrCodeObj) {
		if (branding !== undefined) {
			obj.qr_link_branding = branding;
			delete obj.link_branding;
		} else if (obj.domain) {
			obj.qr_link_branding = obj.domain === 'jmpy.me' ? 'standard' : 'branded';
		} else {
			obj.qr_link_branding = 'standard';
		}
	} else {
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
	}


	if (obj.destination_url !== undefined) {
		const destUrl = obj.destination_url;
		if (destUrl && typeof destUrl === 'string') {
			try {
				const urlToCheck = destUrl.startsWith('http') ? destUrl : 'https://' + destUrl;
				const parsedUrl = new URL(urlToCheck);
				obj.utm_source = obj.utm_source || parsedUrl.searchParams.get('utm_source') || null;
				obj.utm_medium = obj.utm_medium || parsedUrl.searchParams.get('utm_medium') || null;
				obj.utm_campaign = obj.utm_campaign || parsedUrl.searchParams.get('utm_campaign') || null;
				obj.utm_term = obj.utm_term || parsedUrl.searchParams.get('utm_term') || null;
				obj.utm_content = obj.utm_content || parsedUrl.searchParams.get('utm_content') || null;
			} catch (e) {
				obj.utm_source = obj.utm_source || null;
				obj.utm_medium = obj.utm_medium || null;
				obj.utm_campaign = obj.utm_campaign || null;
				obj.utm_term = obj.utm_term || null;
				obj.utm_content = obj.utm_content || null;
			}
		} else {
			obj.utm_source = obj.utm_source || null;
			obj.utm_medium = obj.utm_medium || null;
			obj.utm_campaign = obj.utm_campaign || null;
			obj.utm_term = obj.utm_term || null;
			obj.utm_content = obj.utm_content || null;
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
		short_url: cleaned.short_url || (cleaned.branded_domain ? `https://${cleaned.branded_domain}/${cleaned.custom_alias || cleaned.short_code}` : (cleaned.subdomain ? `https://${cleaned.subdomain}.jmpy.me/${cleaned.custom_alias || cleaned.short_code}` : (cleaned.short_code ? `https://jmpy.me/${cleaned.short_code}` : ''))),
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

function formatQrCodePayload(data: any) {
	const cleaned = cleanResponseData({ ...data });
	let contentUrl = data.short_url || '';
	if (!contentUrl && data.content_data) {
		if (typeof data.content_data === 'string') {
			contentUrl = data.content_data;
		} else if (data.content_data.url) {
			contentUrl = data.content_data.url;
		} else if (data.content_data.text) {
			contentUrl = data.content_data.text;
		}
	}

	return {
		qr_code_id: cleaned.qr_code_id || '',
		name: cleaned.name || '',
		campaign_id: cleaned.campaign_id || data.campaign_id || data.campaignId || null,
		campaign_name: cleaned.campaign_name || data.campaign_name || data.campaignName || (data.campaign?.name) || null,
		content_type: cleaned.content_type || '',
		content_url: contentUrl,
		channel: cleaned.channel || 'n8n',
		qr_code_url: cleaned.qr_code_url || '',
		qr_code_html: cleaned.qr_code_html || '',
		qr_code_excel_sheet_formula: cleaned.qr_code_excel_sheet_formula || '',
		is_password_protected: cleaned.is_password_protected ?? false,
		expires_at: cleaned.expires_at || null,
		is_dynamic: cleaned.is_dynamic ?? false,
		tracking_enabled: cleaned.tracking_enabled ?? true,
		created_at: cleaned.created_at || new Date().toISOString(),
		qr_link_branding: cleaned.qr_link_branding || cleaned.link_branding || cleaned.url_type || 'standard',
		subdomain: cleaned.subdomain || data.subdomain || null,
		branded_domain: cleaned.branded_domain || data.branded_domain || data.brandedDomain || null,
		utm_source: cleaned.utm_source || data.utm_source || data.utmSource || null,
		utm_medium: cleaned.utm_medium || data.utm_medium || data.utmMedium || null,
		utm_campaign: cleaned.utm_campaign || data.utm_campaign || data.utmCampaign || null,
		utm_term: cleaned.utm_term || data.utm_term || data.utmTerm || null,
		utm_content: cleaned.utm_content || data.utm_content || data.utmContent || null,
	};
}

export class Jmpy implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Jmpy.me',
		name: 'jmpy',
		icon: 'file:logo.png', // We can place a placeholder or icon logo.png
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Shorten URLs, generate QR codes, and track campaigns with Jmpy.me',
		defaults: {
			name: 'Jmpy.me',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'jmpyOAuth2Api',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'URL',
						value: 'url',
					},
					{
						name: 'QR Code',
						value: 'qrCode',
					},
					{
						name: 'Campaign',
						value: 'campaign',
					},
				],
				default: 'url',
			},
			...urlOperations,
			...urlFields,
			...qrOperations,
			...qrFields,
			...campaignOperations,
			...campaignFields,
		],
	};

	methods = {
		loadOptions: {
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
						body: { limit: 100, is_polling: true },
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
						url: `${API_BASE_URL}/mcp/execute/listBrandedDomains`,
						body: { limit: 100, is_polling: true },
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.domains || [];
					return items.map((item: any) => ({
						name: item.domain || item.id,
						value: item.domain || item.id,
					}));
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
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const isListOperation = operation === 'list';
		const loopLimit = isListOperation ? 1 : items.length;

		for (let i = 0; i < loopLimit; i++) {
			try {
				let toolName = '';
				let body: any = {};
				let resultData: any = null;

				if (resource === 'url') {
					if (operation === 'shorten') {
						toolName = 'shortenUrl';
						const linkBranding = this.getNodeParameter('linkBranding', i) as string;
						body = {
							url: this.getNodeParameter('url', i) as string,
							name: this.getNodeParameter('name', i) as string,
							url_type: linkBranding,
						};

						if (linkBranding === 'subdomain') {
							body.subdomain = this.getNodeParameter('subdomain', i) as string;
						} else if (linkBranding === 'branded') {
							body.branded_domain = this.getNodeParameter('brandedDomain', i) as string;
						}

						const campaignOption = this.getNodeParameter('campaignOption', i) as string;
						if (campaignOption === 'existing') {
							body.campaign_id = this.getNodeParameter('campaignId', i) as string;
						} else if (campaignOption === 'create') {
							body.new_campaign_name = this.getNodeParameter('newCampaignName', i) as string;
						}

						body.isDynamic = this.getNodeParameter('isDynamic', i, false) as boolean;
						body.trackingEnabled = this.getNodeParameter('trackingEnabled', i, true) as boolean;
						
						const qrCodeVal = this.getNodeParameter('qrCode', i, false) as boolean;
						body.qrCode = qrCodeVal;
						if (qrCodeVal) {
							body.qrFormat = this.getNodeParameter('qrFormat', i, 'image') as string;
						}
					} else if (operation === 'get') {
						toolName = 'getUrl';
						const shortUrlVal = this.getNodeParameter('shortUrl', i) as string;
						let shortCode = shortUrlVal;
						if (shortUrlVal && (shortUrlVal.includes('://') || shortUrlVal.includes('/'))) {
							try {
								const cleanVal = shortUrlVal.trim();
								const urlObj = cleanVal.includes('://') ? new URL(cleanVal) : new URL('http://' + cleanVal);
								const pathSegments = urlObj.pathname.split('/').filter(Boolean);
								if (pathSegments.length > 0) {
									shortCode = pathSegments[pathSegments.length - 1];
								}
							} catch (e) {
								const segments = shortUrlVal.split('/').filter(Boolean);
								if (segments.length > 0) {
									shortCode = segments[segments.length - 1];
								}
							}
						}
						body = {
							shortCode,
							shortUrl: shortUrlVal,
						};
					} else if (operation === 'delete') {
						toolName = 'deleteUrl';
						const shortUrlIdVal = this.getNodeParameter('shortUrlId', i) as string;
						let shortCode = shortUrlIdVal;
						if (shortUrlIdVal && (shortUrlIdVal.includes('://') || shortUrlIdVal.includes('/'))) {
							try {
								const cleanVal = shortUrlIdVal.trim();
								const urlObj = cleanVal.includes('://') ? new URL(cleanVal) : new URL('http://' + cleanVal);
								const pathSegments = urlObj.pathname.split('/').filter(Boolean);
								if (pathSegments.length > 0) {
									shortCode = pathSegments[pathSegments.length - 1];
								}
							} catch (e) {
								const segments = shortUrlIdVal.split('/').filter(Boolean);
								if (segments.length > 0) {
									shortCode = segments[segments.length - 1];
								}
							}
						}
						body = {
							shortCode,
							shortUrlId: shortUrlIdVal,
						};
					} else if (operation === 'update') {
						toolName = 'updateUrl';
						const rawInput = this.getNodeParameter('shortUrlId', i, '') as string;
						const shortUrlIdVal = (rawInput || '').trim();
						if (!shortUrlIdVal) {
							throw new NodeOperationError(this.getNode(), 'Please provide a valid Short Code, ID, or Short URL to update.', { itemIndex: i });
						}
						let shortCode = shortUrlIdVal;
						if (shortUrlIdVal.includes('://') || shortUrlIdVal.includes('/')) {
							try {
								const cleanVal = shortUrlIdVal.trim();
								const urlObj = cleanVal.includes('://') ? new URL(cleanVal) : new URL('http://' + cleanVal);
								const pathSegments = urlObj.pathname.split('/').filter(Boolean);
								if (pathSegments.length > 0) {
									shortCode = pathSegments[pathSegments.length - 1];
								}
							} catch (e) {
								const segments = shortUrlIdVal.split('/').filter(Boolean);
								if (segments.length > 0) {
									shortCode = segments[segments.length - 1];
								}
							}
						}
						if (!shortCode) {
							throw new NodeOperationError(this.getNode(), 'Could not parse a valid Short Code or ID from the input provided.', { itemIndex: i });
						}
						body = {
							shortCode,
							shortUrlId: shortUrlIdVal,
							url: this.getNodeParameter('url', i, '') as string,
							name: this.getNodeParameter('name', i, '') as string,
							custom_alias: this.getNodeParameter('custom_alias', i, '') as string,
							expires_at: this.getNodeParameter('expiresAt', i, '') as string,
							tracking_enabled: this.getNodeParameter('trackingEnabled', i, true) as boolean,
						};

						const campaignOption = this.getNodeParameter('campaignOption', i, 'none') as string;
						if (campaignOption === 'existing') {
							body.campaign_id = this.getNodeParameter('campaignId', i) as string;
						} else if (campaignOption === 'create') {
							body.new_campaign_name = this.getNodeParameter('newCampaignName', i) as string;
						}
					} else if (operation === 'list') {
						toolName = 'listUrls';
						const limit = Math.max(20, Math.min(this.getNodeParameter('limit', i, 20) as number, 100));
						const maxPages = Math.min(this.getNodeParameter('page', i, 1) as number, 10);
						const dateRange = this.getNodeParameter('dateRange', i, 'all_time') as string;
						const startDate = this.getNodeParameter('startDate', i, '') as string;
						const endDate = this.getNodeParameter('endDate', i, '') as string;

						let allUrls: any[] = [];
						let pageNum = 1;
						let hasMore = true;

						while (hasMore && pageNum <= maxPages) {
							const pageResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
								method: 'POST',
								url: `${API_BASE_URL}/mcp/execute/${toolName}`,
								body: cleanObject({
									limit,
									page: pageNum,
									dateRange,
									startDate,
									endDate,
									is_polling: true,
								}),
								json: true,
							});

							const parsed = parseMcpResponse(pageResponse);
							const pageItems = parsed.shortUrls || (Array.isArray(parsed) ? parsed : []);
							if (Array.isArray(pageItems) && pageItems.length > 0) {
								allUrls.push(...pageItems);
								pageNum++;
								const totalPages = parsed.pagination ? (parsed.pagination.totalPages || parsed.pagination.total_pages || 0) : 0;
								if (pageItems.length < limit || (totalPages > 0 && pageNum > totalPages)) {
									hasMore = false;
								}
							} else {
								hasMore = false;
							}
						}
						resultData = { shortUrls: allUrls };
						body = {};
					}
				} else if (resource === 'qrCode') {
					if (operation === 'generate') {
						toolName = 'generateQr';
						const contentType = this.getNodeParameter('contentType', i) as string;
						let contentData: any = {};

						if (contentType === 'url') {
							let qrUrl = (this.getNodeParameter('qrUrl', i) as string).trim();
							if (!qrUrl) {
								throw new Error('URL is required.');
							}
							if (!/^https?:\/\//i.test(qrUrl)) {
								qrUrl = 'https://' + qrUrl;
							}
							try {
								new URL(qrUrl);
							} catch (e) {
								throw new Error('Please enter a valid URL (e.g., https://example.com).');
							}
							contentData = { url: qrUrl };
						} else if (contentType === 'text') {
							const qrText = this.getNodeParameter('qrText', i) as string;
							if (!qrText) {
								throw new Error('Text content is required.');
							}
							contentData = { text: qrText };
						} else if (contentType === 'wifi') {
							const ssid = (this.getNodeParameter('wifiSsid', i) as string).trim();
							const security = this.getNodeParameter('wifiSecurity', i) as string;
							const password = this.getNodeParameter('wifiPassword', i) as string;

							if (!ssid) {
								throw new Error('WiFi Network Name (SSID) is required.');
							}
							if (ssid.length > 32) {
								throw new Error('WiFi Network Name (SSID) cannot exceed 32 characters.');
							}
							if (security === 'WPA') {
								if (!password) {
									throw new Error('WPA/WPA2 password is required.');
								}
								const isHex64 = password.length === 64 && /^[0-9a-fA-F]{64}$/.test(password);
								if (!isHex64 && (password.length < 8 || password.length > 63)) {
									throw new Error('WPA/WPA2 password must be between 8 and 63 characters long (or exactly 64 hex digits).');
								}
							} else if (security === 'WEP') {
								if (!password) {
									throw new Error('WEP password is required.');
								}
								const len = password.length;
								if (len === 10 || len === 26) {
									if (!/^[0-9a-fA-F]+$/.test(password)) {
										throw new Error('WEP password of length 10 or 26 must contain hexadecimal digits only (0-9, A-F).');
									}
								} else if (len !== 5 && len !== 13) {
									throw new Error('WEP password must be 5 or 13 ASCII characters, or 10 or 26 hex digits.');
								}
							}
							contentData = { ssid, security, password };
						} else if (contentType === 'email') {
							const recipient = (this.getNodeParameter('emailRecipient', i) as string).trim();
							const subject = this.getNodeParameter('emailSubject', i) as string;
							const bodyText = this.getNodeParameter('emailBody', i) as string;

							if (!recipient) {
								throw new Error('Email Recipient is required.');
							}
							if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
								throw new Error('Please enter a valid email address (e.g., example@domain.com).');
							}
							contentData = {
								email: recipient,
								subject: subject || undefined,
								body: bodyText || undefined,
							};
						} else if (contentType === 'phone') {
							const phone = (this.getNodeParameter('phoneNum', i) as string).trim();
							if (!phone) {
								throw new Error('Phone number is required.');
							}
							const cleanDigits = phone.replace(/[\s()-]/g, '').replace(/^\+/, '');
							if (cleanDigits.length < 7 || cleanDigits.length > 15) {
								throw new Error('Please enter a valid phone number (at least 7 to 15 digits).');
							}
							contentData = { phone };
						} else if (contentType === 'sms') {
							const phone = (this.getNodeParameter('smsPhone', i) as string).trim();
							const message = this.getNodeParameter('smsMessage', i) as string;
							if (!phone) {
								throw new Error('Phone number is required.');
							}
							const cleanDigits = phone.replace(/[\s()-]/g, '').replace(/^\+/, '');
							if (cleanDigits.length < 7 || cleanDigits.length > 15) {
								throw new Error('Please enter a valid phone number (at least 7 to 15 digits).');
							}
							contentData = {
								phone,
								message: message || undefined,
							};
						} else if (contentType === 'whatsapp') {
							const phone = (this.getNodeParameter('whatsappPhone', i) as string).trim();
							const message = this.getNodeParameter('whatsappMessage', i) as string;
							if (!phone) {
								throw new Error('Phone number is required.');
							}
							const cleanDigits = phone.replace(/[\s()-]/g, '').replace(/^\+/, '');
							if (cleanDigits.length < 7 || cleanDigits.length > 15) {
								throw new Error('Please enter a valid phone number (at least 7 to 15 digits).');
							}
							contentData = {
								phone,
								message: message || undefined,
							};
						} else if (contentType === 'location') {
							const lat = (this.getNodeParameter('locationLatitude', i) as string).trim();
							const lng = (this.getNodeParameter('locationLongitude', i) as string).trim();
							if (!lat || !lng) {
								throw new Error('Latitude and Longitude are required.');
							}
							contentData = {
								latitude: parseFloat(lat),
								longitude: parseFloat(lng),
							};
						} else if (contentType === 'vcard') {
							const first = (this.getNodeParameter('vcardFirstName', i) as string).trim();
							const last = (this.getNodeParameter('vcardLastName', i) as string).trim();
							const phone = (this.getNodeParameter('vcardPhone', i) as string).trim();
							const email = (this.getNodeParameter('vcardEmail', i) as string).trim();
							const org = this.getNodeParameter('vcardOrg', i) as string;
							const title = this.getNodeParameter('vcardTitle', i) as string;
							const url = (this.getNodeParameter('vcardUrl', i) as string).trim();

							if (!first && !last) {
								throw new Error('First Name or Last Name is required for vCard.');
							}
							if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
								throw new Error('Please enter a valid Work Email address in the vCard form.');
							}
							if (phone) {
								const cleanDigits = phone.replace(/[\s()-]/g, '').replace(/^\+/, '');
								if (cleanDigits.length < 7 || cleanDigits.length > 15) {
									throw new Error('Please enter a valid Mobile Phone number in the vCard form (at least 7 to 15 digits).');
								}
							}
							contentData = {
								name: `${first} ${last}`.trim(),
								phone: phone || undefined,
								email: email || undefined,
								organization: `${org || ''} ${title || ''}`.trim() || undefined,
								url: url || undefined,
							};
						}

						body = {
							contentType,
							contentData,
							name: this.getNodeParameter('name', i) as string,
							isDynamic: this.getNodeParameter('isDynamic', i) as boolean,
							trackingEnabled: this.getNodeParameter('trackingEnabled', i) as boolean,
						};

						try {
							const campaignId = this.getNodeParameter('campaignId', i) as string;
							if (campaignId) body.campaign_id = campaignId;
						} catch (e) {}

						try {
							const urlType = this.getNodeParameter('urlType', i) as string;
							if (urlType) body.url_type = urlType;
						} catch (e) {}

						try {
							const brandedDomain = this.getNodeParameter('brandedDomain', i) as string;
							if (brandedDomain) body.branded_domain = brandedDomain;
						} catch (e) {}

						try {
							const subdomain = this.getNodeParameter('subdomain', i) as string;
							if (subdomain) body.subdomain = subdomain;
						} catch (e) {}

						const validateUtmNoSpaces = (paramLabel: string, val: string) => {
							if (val && /\s/.test(val)) {
								const suggested = val.trim().replace(/\s+/g, '_');
								throw new NodeOperationError(
									this.getNode(),
									`Validation Error: "${paramLabel}" cannot contain spaces. Google Analytics requires UTM parameters without spaces. Please replace spaces with underscores (_) or hyphens (-) (e.g., "${suggested}").`
								);
							}
						};

						try {
							const utmSource = this.getNodeParameter('utmSource', i) as string;
							if (utmSource) {
								validateUtmNoSpaces('UTM Source', utmSource);
								body.utm_source = utmSource;
							}
						} catch (e: any) {
							if (e instanceof NodeOperationError) throw e;
						}

						try {
							const utmMedium = this.getNodeParameter('utmMedium', i) as string;
							if (utmMedium) {
								validateUtmNoSpaces('UTM Medium', utmMedium);
								body.utm_medium = utmMedium;
							}
						} catch (e: any) {
							if (e instanceof NodeOperationError) throw e;
						}

						try {
							const utmCampaign = this.getNodeParameter('utmCampaign', i) as string;
							if (utmCampaign) {
								validateUtmNoSpaces('UTM Campaign', utmCampaign);
								body.utm_campaign = utmCampaign;
							}
						} catch (e: any) {
							if (e instanceof NodeOperationError) throw e;
						}

						try {
							const utmTerm = this.getNodeParameter('utmTerm', i) as string;
							if (utmTerm) {
								validateUtmNoSpaces('UTM Term', utmTerm);
								body.utm_term = utmTerm;
							}
						} catch (e: any) {
							if (e instanceof NodeOperationError) throw e;
						}

						try {
							const utmContent = this.getNodeParameter('utmContent', i) as string;
							if (utmContent) {
								validateUtmNoSpaces('UTM Content', utmContent);
								body.utm_content = utmContent;
							}
						} catch (e: any) {
							if (e instanceof NodeOperationError) throw e;
						}
					} else if (operation === 'get') {
						toolName = 'getQrCode';
						const qrCodeIdVal = this.getNodeParameter('qrCodeId', i) as string;
						body = {
							id: qrCodeIdVal,
							qrCodeId: qrCodeIdVal,
						};
					} else if (operation === 'delete') {
						toolName = 'deleteQrCode';
						const qrCodeIdVal = this.getNodeParameter('qrCodeId', i) as string;
						body = {
							id: qrCodeIdVal,
							qrCodeId: qrCodeIdVal,
						};
					} else if (operation === 'update') {
						toolName = 'updateQrCode';
						const contentType = 'url';
						const contentData = { url: this.getNodeParameter('qrUrl', i, '') as string };
						body = {
							id: this.getNodeParameter('qrCodeId', i) as string,
							qrCodeId: this.getNodeParameter('qrCodeId', i) as string,
							name: this.getNodeParameter('name', i, '') as string,
							contentType: contentType,
							content_type: contentType,
							contentData: contentData,
							content_data: contentData,
							tracking_enabled: this.getNodeParameter('trackingEnabled', i, true) as boolean,
						};
					} else if (operation === 'list') {
						toolName = 'listQrCodes';
						const limit = Math.max(20, Math.min(this.getNodeParameter('limit', i, 20) as number, 100));
						const maxPages = Math.min(this.getNodeParameter('page', i, 1) as number, 10);

						let allQrs: any[] = [];
						let pageNum = 1;
						let hasMore = true;

						while (hasMore && pageNum <= maxPages) {
							const pageResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
								method: 'POST',
								url: `${API_BASE_URL}/mcp/execute/${toolName}`,
								body: cleanObject({
									limit,
									page: pageNum,
									is_polling: true,
								}),
								json: true,
							});

							const parsed = parseMcpResponse(pageResponse);
							const pageItems = parsed.qrCodes || (Array.isArray(parsed) ? parsed : []);
							if (Array.isArray(pageItems) && pageItems.length > 0) {
								allQrs.push(...pageItems);
								pageNum++;
								const totalPages = parsed.pagination ? (parsed.pagination.totalPages || parsed.pagination.total_pages || 0) : 0;
								if (pageItems.length < limit || (totalPages > 0 && pageNum > totalPages)) {
									hasMore = false;
								}
							} else {
								hasMore = false;
							}
						}
						resultData = { qrCodes: allQrs };
						body = {};
					}
				} else if (resource === 'campaign') {
					if (operation === 'create') {
						toolName = 'createCampaign';
						body = {
							name: this.getNodeParameter('name', i) as string,
							description: this.getNodeParameter('description', i) as string,
						};
					} else if (operation === 'delete') {
						toolName = 'deleteCampaign';
						body = {
							id: this.getNodeParameter('campaignId', i) as string,
						};
					}
				}

				if (!resultData) {
					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: `${API_BASE_URL}/mcp/execute/${toolName}`,
						body: cleanObject({ ...body, is_polling: true }),
						json: true,
					});

					resultData = parseMcpResponse(response);
				}

				if (resource === 'url') {
					if (operation === 'delete') {
						// Return delete operation response directly without payload format masking
					} else if (operation === 'list' && resultData.shortUrls) {
						resultData.shortUrls = resultData.shortUrls.map((u: any) => formatUrlCreatedPayload(u));
					} else if (Array.isArray(resultData)) {
						resultData = resultData.map((u: any) => formatUrlCreatedPayload(u));
					} else {
						resultData = formatUrlCreatedPayload(resultData);
					}
				} else if (resource === 'qrCode') {
					if (operation === 'delete') {
						// Return delete operation response directly without payload format masking
					} else if (operation === 'list' && resultData.qrCodes) {
						resultData.qrCodes = resultData.qrCodes.map((q: any) => formatQrCodePayload(q));
					} else if (Array.isArray(resultData)) {
						resultData = resultData.map((q: any) => formatQrCodePayload(q));
					} else {
						resultData = formatQrCodePayload(resultData);
					}
				} else if (resource === 'campaign') {
					if (operation === 'delete') {
						// Return delete operation response directly
					} else if (operation === 'list' && resultData.campaigns) {
						resultData.campaigns = resultData.campaigns.map((c: any) => {
							const copy = { ...c };
							delete copy.metadata;
							delete copy.user_id;
							delete copy.userId;
							return copy;
						});
					} else if (Array.isArray(resultData)) {
						resultData = resultData.map((c: any) => {
							const copy = { ...c };
							delete copy.metadata;
							delete copy.user_id;
							delete copy.userId;
							return copy;
						});
					} else if (resultData && typeof resultData === 'object') {
						delete resultData.metadata;
						delete resultData.user_id;
						delete resultData.userId;
					}
				}

				if (operation === 'list') {
					let itemsList: any[] = [];
					if (resource === 'url' && resultData.shortUrls) {
						itemsList = resultData.shortUrls;
					} else if (resource === 'qrCode' && resultData.qrCodes) {
						itemsList = resultData.qrCodes;
					} else if (resource === 'campaign' && resultData.campaigns) {
						itemsList = resultData.campaigns;
					} else {
						itemsList = Array.isArray(resultData) ? resultData : [];
					}

					const executionData = this.helpers.returnJsonArray(itemsList);
					returnData.push(...executionData);
				} else if (Array.isArray(resultData)) {
					const executionData = this.helpers.returnJsonArray(resultData);
					returnData.push(...executionData);
				} else {
					returnData.push({ json: resultData });
				}
			} catch (error: any) {
				const responseData = error?.response?.data || error?.data || error?.error || error?.context?.data;
				let apiErrorMessage: string | undefined;

				if (typeof responseData === 'object' && responseData !== null) {
					apiErrorMessage = responseData.detail || responseData.error || responseData.message;
				} else if (typeof responseData === 'string') {
					try {
						const parsed = JSON.parse(responseData);
						apiErrorMessage = parsed.detail || parsed.error || parsed.message;
					} catch (e) {
						apiErrorMessage = responseData;
					}
				}

				if (!apiErrorMessage) {
					apiErrorMessage = error?.message;
				}

				if (this.continueOnFail()) {
					returnData.push({ json: { error: apiErrorMessage } });
				} else {
					if (apiErrorMessage && typeof apiErrorMessage === 'string') {
						throw new NodeApiError(this.getNode(), { message: apiErrorMessage } as any, {
							message: apiErrorMessage,
							description: apiErrorMessage,
							httpCode: String(error?.statusCode || error?.status || 400),
						});
					}
					throw new NodeApiError(this.getNode(), error as any);
				}
			}
		}

		return [returnData];
	}
}
