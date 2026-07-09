import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
} from 'n8n-workflow';

import { urlOperations, urlFields } from './UrlDescription';
import { qrOperations, qrFields } from './QrDescription';
import { campaignOperations, campaignFields } from './CampaignDescription';

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
		'click_count', 'clickCount'
	];
	if (isSafe) {
		keysToDelete.push('safety_status', 'safetyStatus', 'safety_reason', 'safetyReason', 'safety_report', 'safetyReport');
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
		branded: cleaned.branded || 'no',
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
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: 'https://jmpy.me/mcp/execute/listSubdomains',
						body: { limit: 100, is_polling: true },
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.subdomains || [];
					return items.map((item: any) => ({
						name: item.name || item.domain || item.id,
						value: item.id || item.name,
					}));
				} catch (error) {
					return [];
				}
			},
			async getBrandedDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: 'https://jmpy.me/mcp/execute/listBrandedDomains',
						body: { limit: 100, is_polling: true },
						json: true,
					});
					const data = parseMcpResponse(responseData);
					const items = data.domains || [];
					return items.map((item: any) => ({
						name: item.domain || item.id,
						value: item.id || item.domain,
					}));
				} catch (error) {
					return [];
				}
			},
			async getCampaigns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
						method: 'POST',
						url: 'https://jmpy.me/mcp/execute/listCampaigns',
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
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let toolName = '';
				let body: any = {};

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
							url: this.getNodeParameter('url', i, '') as string,
							name: this.getNodeParameter('name', i, '') as string,
							custom_alias: this.getNodeParameter('custom_alias', i, '') as string,
							expires_at: this.getNodeParameter('expiresAt', i, '') as string,
							tracking_enabled: this.getNodeParameter('trackingEnabled', i, true) as boolean,
						};
					} else if (operation === 'list') {
						toolName = 'listUrls';
						body = {
							limit: this.getNodeParameter('limit', i) as number,
							page: this.getNodeParameter('page', i) as number,
						};
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
					} else if (operation === 'get') {
						toolName = 'getQrCode';
						body = {
							qrCodeId: this.getNodeParameter('qrCodeId', i) as string,
						};
					} else if (operation === 'delete') {
						toolName = 'deleteQrCode';
						body = {
							qrCodeId: this.getNodeParameter('qrCodeId', i) as string,
						};
					} else if (operation === 'update') {
						toolName = 'updateQrCode';
						const contentType = this.getNodeParameter('contentType', i, '') as string;
						let contentData: any = {};
						if (contentType === 'url') {
							contentData = { url: this.getNodeParameter('qrUrl', i, '') as string };
						} else if (contentType === 'text') {
							contentData = { text: this.getNodeParameter('qrText', i, '') as string };
						}
						body = {
							id: this.getNodeParameter('qrCodeId', i) as string,
							qrCodeId: this.getNodeParameter('qrCodeId', i) as string,
							name: this.getNodeParameter('name', i, '') as string,
							contentType: contentType || undefined,
							content_type: contentType || undefined,
							contentData: Object.keys(contentData).length > 0 ? contentData : undefined,
							content_data: Object.keys(contentData).length > 0 ? contentData : undefined,
							tracking_enabled: this.getNodeParameter('trackingEnabled', i, true) as boolean,
							expires_at: this.getNodeParameter('expiresAt', i, '') as string,
						};
					} else if (operation === 'list') {
						toolName = 'listQrCodes';
						body = {
							limit: this.getNodeParameter('limit', i) as number,
							page: this.getNodeParameter('page', i) as number,
						};
					}
				} else if (resource === 'campaign') {
					if (operation === 'create') {
						toolName = 'createCampaign';
						body = {
							name: this.getNodeParameter('name', i) as string,
							description: this.getNodeParameter('description', i) as string,
							tags: this.getNodeParameter('tags', i) as string,
						};
					} else if (operation === 'get') {
						toolName = 'getCampaign';
						body = {
							id: this.getNodeParameter('campaignId', i) as string,
						};
					} else if (operation === 'delete') {
						toolName = 'deleteCampaign';
						body = {
							id: this.getNodeParameter('campaignId', i) as string,
						};
					} else if (operation === 'list') {
						toolName = 'listCampaigns';
						body = {
							limit: this.getNodeParameter('limit', i) as number,
							page: this.getNodeParameter('page', i) as number,
						};
					}
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'jmpyOAuth2Api', {
					method: 'POST',
					url: `https://jmpy.me/mcp/execute/${toolName}`,
					body: cleanObject({ ...body, is_polling: true }),
					json: true,
				});

				let resultData = parseMcpResponse(response);

				if (resource === 'url') {
					if (operation === 'list' && resultData.shortUrls) {
						resultData.shortUrls = resultData.shortUrls.map((u: any) => formatUrlCreatedPayload(u));
					} else if (Array.isArray(resultData)) {
						resultData = resultData.map((u: any) => formatUrlCreatedPayload(u));
					} else {
						resultData = formatUrlCreatedPayload(resultData);
					}
				} else if (resource === 'qrCode') {
					if (operation === 'list' && resultData.qrCodes) {
						resultData.qrCodes = resultData.qrCodes.map((q: any) => formatQrCodePayload(q));
					} else if (Array.isArray(resultData)) {
						resultData = resultData.map((q: any) => formatQrCodePayload(q));
					} else {
						resultData = formatQrCodePayload(resultData);
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
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as any).message } });
				} else {
					throw new NodeApiError(this.getNode(), error as any);
				}
			}
		}

		return [returnData];
	}
}
