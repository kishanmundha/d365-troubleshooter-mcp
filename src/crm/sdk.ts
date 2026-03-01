import { DYNAMICS_365_URL } from '@/env.js';

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

export class CrmSdk {
  private readonly endpoint: string;
  constructor(private readonly token: string) {
    this.endpoint = `${DYNAMICS_365_URL}/api/data/v9.1`;
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

    return response.json();
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
