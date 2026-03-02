import { DYNAMICS_365_URL } from '@/env.js';
import { transformJsonToFormDefinition } from './form.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RetrieveMultipleResult<T = any> {
  /**
   * An array of JSON objects, where each object represents the retrieved entity record containing attributes and their values as key: value pairs. The Id of the entity record is retrieved by default.
   */
  entities: T[];
  /**
   * If the number of records being retrieved is more than the value specified in the maxPageSize parameter, this attribute returns the URL to return next set of records.
   */
  nextLink?: string;
  /**
   * The total number of records that satisfy the query.
   */
  count: number;
}

export interface PluginTraceItem {
  id: string;
  typeName: string;
  messageName: string;
  primaryEntity: string;
  pluginSetpId: string;
  startTime: string;
  durationMs: number | null;
  createdOn: string;
  messageBlock: string;
  exceptionDetails: string;
  operationType: number | null;
  operationTypeName: string;
  mode: number | null;
  modeName: string;
  requestId: string;
  correlationId: string;
  depth: number | null;
}

export class CrmSdk {
  private readonly endpoint: string;
  constructor(private readonly token: string) {
    this.endpoint = `${DYNAMICS_365_URL}/api/data/v9.1`;
  }

  private escapeFetchXmlValue(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }

  private async fetch<T = any>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json; odata.metadata=minimal',
        prefer: 'odata.include-annotations="*"',
        'odata-version': '4.0',
      },
    });

    if (!response.ok) {
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const error = await response.json();

        if (error.error.message) {
          throw new Error(error.error.message, { cause: error.error.code });
        }
      }

      throw new Error(response.statusText);
    }

    if (response.headers.get('Content-Type')?.includes('application/json')) {
      return response.json();
    }

    return response.text() as T;
  }

  public async fetchEntities(search?: string) {
    const url = new URL(`${this.endpoint}/EntityDefinitions`);
    url.searchParams.set(
      '$select',
      'LogicalName,SchemaName,DisplayName,EntitySetName',
    );

    const result = await this.fetch(url.toString());

    const tables = result.value.map((record: any) => ({
      logicalName: record.LogicalName,
      entitySetName: record.EntitySetName ?? '',
      displayName: record.DisplayName?.UserLocalizedLabel?.Label ?? '',
    })) as {
      logicalName: string;
      entitySetName: string;
      displayName: string;
    }[];

    if (search) {
      const lowerSearch = search.toLowerCase();
      return tables.filter(
        (table) =>
          table.logicalName.toLowerCase().includes(lowerSearch) ||
          table.displayName.toLowerCase().includes(lowerSearch),
      );
    }

    return tables;
  }

  public async fetchEntityDefination(logicalName: string) {
    const url = new URL(
      `${this.endpoint}/EntityDefinitions(LogicalName='${logicalName}')`,
    );
    url.searchParams.set('$select', 'LogicalName,SchemaName,DisplayName');
    url.searchParams.set(
      '$expand',
      'Attributes($select=LogicalName,SchemaName,AttributeType,AttributeTypeName,IsCustomAttribute,DisplayName)',
    );

    return this.fetch(url.toString());
  }

  public async getObjectTypeCodeByLogicalName(
    logicalName: string,
  ): Promise<number | null> {
    const url = new URL(
      `${this.endpoint}/EntityDefinitions(LogicalName='${logicalName}')`,
    );
    url.searchParams.set('$select', 'ObjectTypeCode');

    const result = await this.fetch(url.toString());
    return result?.ObjectTypeCode ?? null;
  }

  public async getEntityPlugins(logicalName: string) {
    const objectTypeCode =
      await this.getObjectTypeCodeByLogicalName(logicalName);

    if (!objectTypeCode) {
      throw new Error(
        `ObjectTypeCode not found for logical name: ${logicalName}`,
      );
    }

    const fetchXml = `<fetch>
      <entity name='sdkmessageprocessingstep'>
        <attribute name="name" />
        <attribute name="stage" />
        <attribute name="mode" />
        <attribute name="filteringattributes" />
        <attribute name="statecode" />
        <attribute name="impersonatinguserid" />
        <link-entity name="sdkmessagefilter" from="sdkmessagefilterid" to="sdkmessagefilterid" alias="sdkmessagefilter">
          <attribute name="primaryobjecttypecode" />
          <filter type="and">
            <condition attribute="primaryobjecttypecode" operator="eq" value="${objectTypeCode}" />
          </filter>
        </link-entity>
        <link-entity name="sdkmessage" from="sdkmessageid" to="sdkmessageid" alias="sdkmessage">
          <attribute name="name" />
        </link-entity>
        <filter type="and">
          <condition attribute="name" operator="like" value="PfiCrm.BusinessRules.Steps%" />
        </filter>
      </entity>
    </fetch>`;

    const result = await this.fetchXml(
      'sdkmessageprocessingsteps',
      fetchXml,
      100,
    );

    const fetchXmlForImages = `<fetch>
      <entity name='sdkmessageprocessingstepimage'>
        <attribute name="sdkmessageprocessingstepimageid" />
        <attribute name="name" />
        <attribute name="imagetype" />
        <attribute name="entityalias" />
        <attribute name="sdkmessageprocessingstepid" />
        <attribute name="attributes" />
        <filter type="and">
          <condition attribute="sdkmessageprocessingstepid" operator="in">
            ${result.entities
              .map(
                (step) => `<value>${step.sdkmessageprocessingstepid}</value>`,
              )
              .join('')}
          </condition>
        </filter>
      </entity>
    </fetch>`;

    const imagesResult = await this.fetchXml(
      'sdkmessageprocessingstepimages',
      fetchXmlForImages,
      100,
    );

    const transformedResult = result.entities.map((item) => {
      const images = imagesResult.entities
        .filter(
          (image) =>
            image._sdkmessageprocessingstepid_value ===
            item.sdkmessageprocessingstepid,
        )
        .map((image) => ({
          name: image.name,
          imagetype: image.imagetype,
          imagetypeName:
            image['imagetype@OData.Community.Display.V1.FormattedValue'],
          entityalias: image.entityalias,
          attributes: image.attributes ?? '',
        }));

      return {
        id: item.sdkmessageprocessingstepid,
        message: item['sdkmessage.name'] ?? '',
        mode: item.mode,
        modeName: item['mode@OData.Community.Display.V1.FormattedValue'],
        stage: item.stage,
        stageName: item['stage@OData.Community.Display.V1.FormattedValue'],
        statecode: item.statecode,
        statecodeName:
          item['statecode@OData.Community.Display.V1.FormattedValue'],
        filteringattributes: item.filteringattributes ?? '',
        primaryEntityLogicalName:
          item['sdkmessagefilter.primaryobjecttypecode'] ?? '',
        images,
      };
    });

    return transformedResult;
  }

  public async searchWebResources(search: string, limit = 25) {
    const escapedSearch = this.escapeFetchXmlValue(search.trim());
    const fetchXml = `<fetch>
      <entity name='webresource'>
        <attribute name='webresourceid' />
        <attribute name='name' />
        <attribute name='displayname' />
        <attribute name='webresourcetype' />
        <attribute name='modifiedon' />
        <filter type='or'>
          <condition attribute='name' operator='like' value='%${escapedSearch}%' />
          <condition attribute='displayname' operator='like' value='%${escapedSearch}%' />
        </filter>
      </entity>
    </fetch>`;

    const result = await this.fetchXml('webresourceset', fetchXml, limit);

    const transformredResult = result.entities.map((item) => ({
      id: item.webresourceid,
      name: item.name,
      displayName: item.displayname ?? '',
      webresourcetype: item.webresourcetype ?? null,
      webresourcetypeName:
        item['webresourcetype@OData.Community.Display.V1.FormattedValue'] ?? '',
      modifiedOn: item.modifiedon ?? '',
    }));

    return transformredResult;
  }

  public async getWebResourceContentById(webResourceId: string) {
    const url = `${this.endpoint}/webresourceset(${webResourceId})/content/$value`;

    const result = await this.fetch<string>(url);

    // result is a base64 encoded string, we can decode it to get the original content
    const decodedContent = Buffer.from(result, 'base64').toString('utf-8');

    return decodedContent;
  }

  public async getWebResourceContentByName(webResourceName: string) {
    const url = `${this.endpoint}/webresourceset?$filter=name eq '${webResourceName}'&$select=content`;

    const result = await this.fetch<{ value: { content: string }[] }>(url);

    if (result.value.length === 0) {
      throw new Error(`Web resource with name ${webResourceName} not found`);
    }

    const content = result.value[0]!.content;

    // content is a base64 encoded string, we can decode it to get the original content
    const decodedContent = Buffer.from(content, 'base64').toString('utf-8');

    console.log('Decoded content:', decodedContent);

    return decodedContent;
  }

  public async findPluginTraces(
    {
      primaryEntity,
      pluginSetpId,
      messageName,
      from,
      to,
    }: {
      primaryEntity?: string | undefined;
      pluginSetpId?: string | undefined;
      messageName?: string | undefined;
      from?: string | undefined;
      to?: string | undefined;
    },
    limit = 25,
  ) {
    if (!primaryEntity && !pluginSetpId) {
      throw new Error(
        'At least primaryEntity or pluginSetpId must be provided',
      );
    }

    primaryEntity = this.escapeFetchXmlValue(primaryEntity?.trim() ?? '');
    pluginSetpId = this.escapeFetchXmlValue(pluginSetpId?.trim() ?? '');
    messageName = this.escapeFetchXmlValue(messageName?.trim() ?? '');

    const filterConditions = [];

    if (primaryEntity) {
      filterConditions.push(
        `<condition attribute='primaryentity' operator='eq' value='${primaryEntity}' />`,
      );
    }

    if (pluginSetpId) {
      filterConditions.push(
        `<condition attribute='sdkmessageprocessingstepid' operator='eq' value='${pluginSetpId}' />`,
      );
    }

    if (messageName) {
      filterConditions.push(
        `<condition attribute='messagename' operator='eq' value='${messageName}' />`,
      );
    }

    if (from) {
      filterConditions.push(
        `<condition attribute='performanceexecutionstarttime' operator='on-or-after' value='${from}' />`,
      );
    }

    if (to) {
      filterConditions.push(
        `<condition attribute='performanceexecutionstarttime' operator='on-or-before' value='${to}' />`,
      );
    }

    const fetchXml = `<fetch top='${limit}' no-lock='true'>
      <entity name='plugintracelog'>
        <attribute name='plugintracelogid' />
        <attribute name='typename' />
        <attribute name='messagename' />
        <attribute name='primaryentity' />
        <attribute name='performanceexecutionduration' />
        <attribute name='createdon' />
        <attribute name='messageblock' />
        <attribute name='exceptiondetails' />
        <attribute name='pluginstepid' />
        <attribute name='operationtype' />
        <attribute name='mode' />
        <attribute name='requestid' />
        <attribute name='correlationid' />
        <attribute name='depth' />
        <attribute name='performanceexecutionstarttime' />
        <order attribute='createdon' descending='true' />
        <filter type='or'>
          ${filterConditions.join('')}
        </filter>
      </entity>
    </fetch>`;

    const result = await this.fetchXml('plugintracelogs', fetchXml, limit);

    const transformedResult = result.entities.map((item) => ({
      id: item.plugintracelogid,
      typeName: item.typename ?? '',
      messageName: item.messagename ?? '',
      primaryEntity: item.primaryentity ?? '',
      pluginSetpId: item.pluginstepid,
      startTime: item.performanceexecutionstarttime ?? '',
      durationMs: item.performanceexecutionduration ?? null,
      createdOn: item.createdon ?? '',
      messageBlock: item.messageblock ?? '',
      exceptionDetails: item.exceptiondetails ?? '',
      operationType: item.operationtype ?? null,
      operationTypeName:
        item['operationtype@OData.Community.Display.V1.FormattedValue'] ?? '',
      mode: item.mode ?? null,
      modeName: item['mode@OData.Community.Display.V1.FormattedValue'] ?? '',
      depth: item.depth ?? null,
    })) as PluginTraceItem[];

    return {
      traces: transformedResult,
      count: result.count,
    };
  }

  public async getEntityForms(logicalName: string, limit = 25) {
    const objectTypeCode =
      await this.getObjectTypeCodeByLogicalName(logicalName);

    // type 2 = Main form
    // type 4 = Quick Create form

    const fetchXml = `<fetch top='${limit}' no-lock='true'>
      <entity name='systemform'>
        <attribute name='formid' />
        <attribute name='name' />
        <attribute name='description' />
        <attribute name='objecttypecode' />
        <attribute name='type' />
        <attribute name='isdefault' />
        <attribute name='formactivationstate' />
        <filter>
          <condition attribute='objecttypecode' operator='eq' value='${objectTypeCode}' />
          <condition attribute='type' operator='in'>
            <value>2</value>
            <value>4</value>
          </condition>
        </filter>
      </entity>
    </fetch>`;

    const result = await this.fetchXml('systemforms', fetchXml, limit);

    console.log('Fetched forms:', result.entities);

    return result.entities.map((item) => ({
      id: item.formid,
      name: item.name ?? '',
      description: item.description ?? '',
      tableLogicalName: item.objecttypecode ?? '',
      type: item.type ?? null,
      typeName: item['type@OData.Community.Display.V1.FormattedValue'] ?? '',
      isDefault: item.isdefault ?? null,
      formActivationState: item.formactivationstate ?? null,
      formActivationStateName:
        item['formactivationstate@OData.Community.Display.V1.FormattedValue'] ??
        '',
    }));
  }

  public async getFormDefinitionById(formId: string) {
    const url = `${this.endpoint}/systemforms(${formId})?$select=formjson,formxml`;

    const result = await this.fetch<{
      formjson?: string;
    }>(url);

    return transformJsonToFormDefinition(result.formjson ?? '');
  }

  public async fetchXml<T = any>(
    entityLogicalName: string,
    xml: string,
    maxPageSize?: number,
  ): Promise<RetrieveMultipleResult<T>> {
    try {
      return this.retrieveMultipleRecords<T>(
        entityLogicalName,
        '?fetchXml=' + encodeURIComponent(xml),
        maxPageSize,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        typeof error.cause === 'string' &&
        error.cause === '0x80040201'
      ) {
        console.error('Invalid XML:', xml);
      } else {
        console.error(error);
        console.error('XML:', xml);
      }

      throw error;
    }
  }

  public async retrieveMultipleRecords<T = unknown>(
    entityLogicalName: string,
    options?: string,
    maxPageSize?: number,
  ): Promise<RetrieveMultipleResult<T>> {
    const url = new URL(`${this.endpoint}/${entityLogicalName}`);

    const searchParams = new URLSearchParams(options);

    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    if (maxPageSize) {
      url.searchParams.set('$top', maxPageSize.toString());
    }

    url.searchParams.set('$count', 'true');

    const result = await this.fetch<{
      value: unknown[];
      '@odata.count': number;
    }>(url.toString());

    return {
      entities: result.value as T[],
      count: result['@odata.count'],
    };
  }
}
