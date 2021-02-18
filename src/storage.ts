import { Storage as GoogleCloudStorage } from '@google-cloud/storage';
import getStream from 'get-stream';
import { Config } from './config';

export enum IssueState {
  /** An issue that is still open */
  Open = 'OPEN',
  /** An issue that has been closed */
  Closed = 'CLOSED',
}

export interface GithubIssue {
  todoistId?: number;
  id: string;
  number: number;
  title: string;
  url: string;
  state: IssueState;
  repo: string;
}

export interface TodoistIssue {
  id: number;
  checked: number;
}

export interface SyncStorage {
  github: GithubIssue[];
  todoist: TodoistIssue[];
}

export class Storage {
  constructor(
    readonly config: Config,
    readonly storage = new GoogleCloudStorage(),
  ) {}

  async get(): Promise<SyncStorage> {
    const file = this.getFile();
    const [exists] = await file.exists();
    if (exists) {
      return JSON.parse(await getStream(file.createReadStream()));
    }

    return { github: [], todoist: [] };
  }

  async set(data: SyncStorage): Promise<SyncStorage> {
    const file = this.getFile();
    await file.save(JSON.stringify(data));
    return data;
  }

  private getFile() {
    return this.storage
      .bucket(this.config.storageBucket)
      .file(this.config.syncFileName);
  }
}
