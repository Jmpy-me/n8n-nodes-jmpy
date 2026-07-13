import { INodeProperties } from 'n8n-workflow';

export const campaignOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['campaign'],
			},
		},
		options: [
			{
				name: 'Create Campaign',
				value: 'create',
				description: 'Create a new campaign to group related URLs',
				action: 'Create a campaign',
			},
			{
				name: 'Delete Campaign',
				value: 'delete',
				description: 'Delete a campaign',
				action: 'Delete a campaign',
			},
		],
		default: 'create',
	},
];

export const campaignFields: INodeProperties[] = [
	// ----- Campaign: Create -----
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['campaign'],
				operation: ['create'],
			},
		},
		default: '',
		placeholder: 'Black Friday Campaign',
		description: 'Campaign name. Must be unique.',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['campaign'],
				operation: ['create'],
			},
		},
		default: '',
		placeholder: 'Links for Black Friday promotions',
		description: 'Campaign description for organization',
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['campaign'],
				operation: ['create'],
			},
		},
		default: '',
		placeholder: 'promo, marketing',
		description: 'Tags for organizing and filtering campaigns (comma-separated)',
	},

	// ----- Campaign: Delete -----
	{
		displayName: 'Campaign ID or Name',
		name: 'campaignId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['campaign'],
				operation: ['delete'],
			},
		},
		default: '',
		description: 'The unique ID or name of the campaign',
	},
];
