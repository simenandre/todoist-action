import { debug, setFailed } from '@actions/core';
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

  debug(`Github Diff: ${JSON.stringify(github, null, 2)}`);

  try {
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
        github.deleted.map(async d => {
          if (d.todoistId) {
            const i = store.github.findIndex(g => g.id === d.id);
            await t.items.delete({
              id: d.todoistId,
            });
            delete store.github[i];
          }
        }),
      );
    }
  } catch (e) {
    debug(`Storing this object: ${JSON.stringify(store, null, 2)}`);
    await storage.set(store);
    throw e;
  }

  debug(`Storing this object: ${JSON.stringify(store, null, 2)}`);
  await storage.set(store);
};

main().catch(e => {
  debug(`error: ${JSON.stringify(e)}`);
  setFailed(e.message);
});
