import { debug, setFailed } from '@actions/core';
import { Todoist } from 'todoist';
import { makeConfig } from './config';
import { githubIssuesDiff, makeGithubClient, notEmpty } from './github';
import { GithubIssue, IssueState, Storage } from './storage';
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
      const created = await Promise.all(
        github.created
          .filter(f => notEmpty(f) && f.state !== IssueState.Closed)
          .map(async i => {
            const itemArgs = await parseTodoistFromGithubIssue(i);
            const exists = t.items.get().find(i => i.content === itemArgs.content);

            if (exists) {
              debug(`GitHub issue ${i.repo}#${i.number} exists already in Todoist 🤷‍♂️`);
            }

            const item = exists ? exists : await t.items.add(itemArgs);
            debug(`GitHub issue ${i.repo}#${i.number} was created.`);
            const ghIssue = <GithubIssue>{
              ...i,
              todoistId: item?.id,
            };
            return ghIssue;
          }),
      );
      store.github.push(...created);
    }

    if (github.updated) {
      await Promise.all(
        github.updated.filter(notEmpty).map(async d => {
          const i = store.github.findIndex(g => g && g.id === d.id);
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
        github.deleted.filter(notEmpty).map(async d => {
          if (d.todoistId) {
            await t.items.delete({
              id: d.todoistId,
            });
            debug(`GitHub issue ${d.repo}#${d.number} was deleted.`);
            const i = store.github.findIndex(g => g && g.id === d.id);
            store.github.splice(i, 1);
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
  debug(e.stack);
  setFailed(e.message);
});
