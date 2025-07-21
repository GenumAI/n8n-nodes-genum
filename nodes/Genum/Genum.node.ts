import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeListSearchResult,
	INodeParameterResourceLocator,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class Genum implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Genum',
		name: 'genum',
		icon: 'file:genum.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Genum API',
		defaults: {
			name: 'Genum',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'genumApi',
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
						name: 'Prompt',
						value: 'prompt',
					},
				],
				default: 'prompt',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['prompt'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many prompts',
						action: 'Get many prompts',
					},
					{
						name: 'Run',
						value: 'run',
						description: 'Run a prompt with input',
						action: 'Run a prompt',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Prompt',
				name: 'promptId',
				type: 'resourceLocator',
				default: '',
				description: 'Select a prompt to run',
				modes: [
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						hint: 'Enter a prompt ID',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[0-9]+$',
									errorMessage: 'The ID must be a number',
								},
							},
						],
						placeholder: '150',
					},
					{
						displayName: 'List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getPrompts',
							searchable: true,
							searchFilterRequired: false,
						},
					},
				],
				displayOptions: {
					show: {
						resource: ['prompt'],
						operation: ['run'],
					},
				},
			},
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						resource: ['prompt'],
						operation: ['run'],
					},
				},
				placeholder: 'Enter your input text here',
				description: 'The text to process with the prompt',
				default: '',
			},
			{
				displayName: 'Memory Key',
				name: 'memoryKey',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['prompt'],
						operation: ['run'],
					},
				},
				placeholder: 'optional-memory-key',
				description: 'Optional key for memory context',
				default: '',
			},
			{
				displayName: 'Productive',
				name: 'productive',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['prompt'],
						operation: ['run'],
					},
				},
				description: 'Whether to use committed prompt. Default is true.',
				default: true,
			},
		],
	};

	methods = {
		loadOptions: {
			async getPrompts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('genumApi');
				const response = await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://api.genum.ai/api/v1/prompts',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${credentials.apiToken}`,
					},
				});

				// Handle the response structure: { prompts: [...] }
				let prompts: any[] = [];
				if (response && response.prompts) {
					prompts = response.prompts;
				} else if (Array.isArray(response)) {
					prompts = response;
				}

				return prompts.map((prompt: any) => ({
					name: `${prompt.name} (ID: ${prompt.id})`,
					value: prompt.id.toString(),
				}));
			},
		},
		listSearch: {
			async getPrompts(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('genumApi');
				const response = await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://api.genum.ai/api/v1/prompts',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${credentials.apiToken}`,
					},
				});

				// Handle the response structure: { prompts: [...] }
				let prompts: any[] = [];
				if (response && response.prompts) {
					prompts = response.prompts;
				} else if (Array.isArray(response)) {
					prompts = response;
				}

				// Filter prompts if search term is provided
				if (filter) {
					prompts = prompts.filter((prompt: any) => 
						prompt.name.toLowerCase().includes(filter.toLowerCase()) ||
						prompt.id.toString().includes(filter)
					);
				}

				const results = prompts.map((prompt: any) => ({
					name: `${prompt.name} (ID: ${prompt.id})`,
					value: prompt.id.toString(),
				}));

				return {
					results,
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		let responseData;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'prompt') {
					if (operation === 'getAll') {
						const credentials = await this.getCredentials('genumApi');
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: 'https://api.genum.ai/api/v1/prompts',
							headers: {
								'Accept': 'application/json',
								'Content-Type': 'application/json',
								'Authorization': `Bearer ${credentials.apiToken}`,
							},
						});
					} else if (operation === 'run') {
						const credentials = await this.getCredentials('genumApi');
						const promptIdParam = this.getNodeParameter('promptId', i);
						const question = this.getNodeParameter('question', i) as string;
						const memoryKey = this.getNodeParameter('memoryKey', i) as string;
						const productive = this.getNodeParameter('productive', i) as boolean;

						// Handle Resource Locator format
						let promptId: string;
						if (promptIdParam && typeof promptIdParam === 'object' && '__rl' in promptIdParam) {
							const resourceLocator = promptIdParam as INodeParameterResourceLocator;
							promptId = String(resourceLocator.value || '');
						} else {
							promptId = String(promptIdParam || '');
						}

						const body: any = {
							id: parseInt(promptId, 10), // Convert to number for API
							question: question,
							productive: productive,
						};

						if (memoryKey) {
							body.memoryKey = memoryKey;
						}

						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: 'https://api.genum.ai/api/v1/prompts/run',
							headers: {
								'Accept': 'application/json',
								'Content-Type': 'application/json',
								'Authorization': `Bearer ${credentials.apiToken}`,
							},
							body: body,
						});
					}
				}

				if (Array.isArray(responseData)) {
					returnData.push(...responseData.map((item) => ({ json: item })));
				} else {
					returnData.push({ json: responseData });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: this.getInputData(i)[0].json, error, pairedItem: i });
				} else {
					if (error.context) {
						error.context.itemIndex = i;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex: i,
					});
				}
			}
		}

		return [returnData];
	}
} 