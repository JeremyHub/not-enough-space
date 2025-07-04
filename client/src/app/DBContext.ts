import { createContext } from 'react';
import { Bit, Moon, DbConnection, Metadata, User } from '.././module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

type DBContextType = {
  conn: DbConnection;
  identity: Identity;
  self: User;
  users: Map<string, User>;
  bits: Map<number, Bit>;
  moons: Map<number, Moon>;
  metadata: Metadata;
  canvasWidth: number;
  canvasHeight: number;
  renderBuffer: number;
};

export const DBContext = createContext<DBContextType | undefined>(undefined);
export type { DBContextType };
