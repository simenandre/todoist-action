import fetch from '@adobe/node-fetch-retry';
import { GraphQLClient } from 'graphql-request';
import { Config } from './config';
import { Sdk, getSdk } from './generated/graphql';
import { fromGithub, isGithubIssueEqual } from './serialize';
import { GithubIssue } from './storage';

export function makeGithubClient(token: string): Sdk {
  const client = new GraphQLClient('https://api.github.com/graphql', {
    headers: {
      authorization: `Bearer ${token}`,
    },
    fetch,
  });
  return getSdk(client);
}

export interface CompareResponse {
  created?: GithubIssue[];
  updated?: GithubIssue[];
  deleted?: GithubIssue[];
}

export async function githubIssuesDiff(
  client: Sdk,
  config: Config,
  source: GithubIssue[],
): Promise<CompareResponse> {
  const res = await client.Search({
    query: config.query,
  });
  const { nodes } = res.search;

  if (!nodes) {
    return {
      created: [],
      updated: [],
      deleted: [],
    };
  }

  const n = nodes.map(fromGithub).filter(notEmpty);

  return compareGithubIssues(source, n);
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function compareGithubIssues(
  source: GithubIssue[],
  destination: GithubIssue[],
): CompareResponse {
  if (source.length === 0) {
    return {
      created: destination,
    };
  }

  const created = destination.filter(d => !source.find(s => d.id === s.id));

  return {
    created,
    updated: destination
      .map(d => {
        const s = source.find(s => s && d.id === s.id);
        if (!isGithubIssueEqual(s, d) && s) {
          return { ...s, ...d };
        }
      })
      .filter(notEmpty),
    deleted: source.filter(
      s => !destination.find(d => s && d && d.id === s.id),
    ),
  };
}
