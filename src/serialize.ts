/* eslint @typescript-eslint/no-unused-vars: 0 */
import equal from 'deep-equal';
import { PullRequestState, SearchResultFragment } from './generated/graphql';
import { GithubIssue, IssueState, TodoistIssue } from './storage';

export function fromTodoist(
  issue: import('todoist/dist/v8-types').Item,
): Partial<TodoistIssue> {
  return {
    id: issue.id,
    checked: issue.checked,
  };
}

export function fromGithub(
  issue: SearchResultFragment | null,
): GithubIssue | undefined {
  if (issue === null) {
    return;
  }
  if (issue.__typename === 'PullRequest') {
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      url: issue.url,
      state:
        issue.prState === PullRequestState.Open
          ? IssueState.Open
          : IssueState.Closed,
      repo: `${issue.repository?.owner.login}/${issue.repository?.name}`,
    };
  } else if (issue.__typename === 'Issue') {
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      url: issue.url,
      state: issue.issueState,
      repo: `${issue.repository?.owner.login}/${issue.repository?.name}`,
    };
  }

  return;
}

export function isGithubIssueEqual(
  a: GithubIssue | undefined,
  b: Partial<GithubIssue>,
): boolean {
  if (!a) return false;
  const { todoistId: _, ...restA } = a;
  const { todoistId: __, ...restB } = b;
  return equal(restA, restB);
}
