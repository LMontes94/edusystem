import { AbilityBuilder, MongoAbility, createMongoAbility } from '@casl/ability';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read   = 'read',
  Update = 'update',
  Delete = 'delete',
  Export = 'export',
}

export type Subjects =
  | 'Institution'
  | 'User'
  | 'Student'
  | 'Course'
  | 'Subject'
  | 'Grade'
  | 'Attendance'
  | 'Announcement'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

export { AbilityBuilder, createMongoAbility };
