import { debug, setFailed } from '@actions/core';
import { Todoist } from 'todoist';
import { makeConfig } from './config';
import { githubIssuesDiff, makeGithubClient } from './github';
import { GithubIssue, Storage } from './storage';
import {
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
  try {
    if (github.created) {
      const updated = await Promise.all(
        github.created.map(async i => {
          const itemArgs = await parseTodoistFromGithubIssue(i);
          const item = await t.items.add(itemArgs);
          debug(`GitHub issue ${i.repo}#${i.id} was updated.`);
          return <GithubIssue>{
            ...i,
            todoistId: item?.id,
          };
        }),
      );
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
            debug(`GitHub issue ${d.repo}#${d.number} was updated.`);

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
            debug(`GitHub issue ${d.repo}#${d.number} was deleted.`);
            delete store.github[i];
          }
        }),
      );
    }
  } catch (e) {
    await storage.set(store);
    throw e;
  }
  await storage.set(store);
};

main().catch(e => {
  debug(`error: ${JSON.stringify(e)}`);
  setFailed(e.message);
});
