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

export async function handleNewIssues(
  todoist: ReturnType<typeof Todoist>,
  issues: GithubIssue[],
): Promise<GithubIssue[]> {
  const updated = await Promise.all(
    issues.map(async i => {
      const itemArgs = await parseTodoistFromGithubIssue(i);
      const item = await todoist.items.add(itemArgs);
      return <GithubIssue>{
        ...i,
        todoistId: item?.id,
      };
    }),
  );
  return updated;
}

export async function handleTodoistUpdatedStatus(
  todoist: ReturnType<typeof Todoist>,
  d: GithubIssue,
  s: GithubIssue,
) {
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