import { debug } from '@actions/core';
import { Todoist } from 'todoist';
import { makeConfig } from './config';
import { githubIssuesDiff, makeGithubClient } from './github';
import { Storage } from './storage';
import {
  handleNewIssues,
  handleTodoistUpdatedStatus,
  parseTodoistFromGithubIssue,
} from './todoist';

const main = async () => {
  const config = await makeConfig();
  const storage = new Storage(config);

  const store = await storage.get();
  const o = makeGithubClient(config.githubToken);

  const t = Todoist(config.todoistToken);
  await t.sync();

  const github = await githubIssuesDiff(o, config, store.github);

  if (github.created) {
    const updated = await handleNewIssues(t, github.created);
    store.github.push(...updated);
  }

  if (github.updated) {
    await Promise.all(
      github.updated.map(async d => {
        const i = store.github.findIndex(g => g.id === d.id);
        const s = store.github[i];
        const itemArgs = await parseTodoistFromGithubIssue(d);
        if (d.todoistId) {
          await t.items.update({
            id: d.todoistId,
            ...itemArgs,
          });
          debug(`GitHub issue #${d.number} was updated.`);

          if (d.state !== s.state) {
            await handleTodoistUpdatedStatus(t, d, s);
          }

          store.github[i] = d;
        }
      }),
    );
  }

  if (github.deleted) {
    await Promise.all(
      github.updated.map(async d => {
        if (d.todoistId) {
          await t.items.complete({
            id: d.todoistId,
          });
        }
      }),
    );
  }

  // await Promise.all(
  //   t.items.get().map(s => {
  //     const i = store.github.findIndex(g => g.todoistId === s.id);
  //     const gh = store.github[i];
  //   }),
  // );

  await storage.set(store);
};

main();
