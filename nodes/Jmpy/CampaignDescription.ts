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
				name: 'Get Campaign Detail',
				value: 'get',
				description: 'Get details of a campaign by name or UUID',
				action: 'Get a campaign',
			},
			{
				name: 'List Campaigns',
				value: 'list',
				description: 'Get a list of all your campaigns',
				action: 'List all campaigns',
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

	// ----- Campaign: Get Detail / Delete -----
	{
		displayName: 'Campaign ID or Name',
		name: 'campaignId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['campaign'],
				operation: ['get', 'delete'],
			},
		},
		default: '',
		description: 'The unique ID or name of the campaign',
	},

	// ----- Campaign: List -----
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['campaign'],
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
				resource: ['campaign'],
				operation: ['list'],
			},
		},
		default: 1,
		description: 'Page number for pagination',
	},
];
