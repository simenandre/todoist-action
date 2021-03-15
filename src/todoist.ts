import { debug } from '@actions/core';
import { Todoist } from 'todoist';
import { GithubIssue, IssueState } from './storage';

export async function parseTodoistFromGithubIssue(
  issue: Omit<GithubIssue, 'todoistId'>,
): Promise<import('todoist/dist/v8-types').ItemAdd> {
  return {
    content: `([${issue.repo}#${issue.number}](${issue.url})) ${issue.title}`,
  };
}

export async function handleTodoistUpdatedStatus(
  todoist: ReturnType<typeof Todoist>,
  d: GithubIssue,
  s: GithubIssue,
): Promise<void> {
  if (!d.todoistId) throw new Error('Expect todoistId not be empty');
  // If was reopened:
  if (s.state === IssueState.Closed && d.state === IssueState.Open) {
    await todoist.items.uncomplete({
      id: d.todoistId,
    });
    debug(`GitHub issue #${d.number} was reopened.`);
  }
  // If was closed
  if (s.state === IssueState.Open && d.state === IssueState.Closed) {
    await todoist.items.complete({
      id: d.todoistId,
    });
    debug(`GitHub issue #${d.number} was closed.`);
  }
}
