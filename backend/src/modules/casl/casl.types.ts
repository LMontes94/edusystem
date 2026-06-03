import { AbilityBuilder, MongoAbility, createMongoAbility } from '@casl/ability';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read   = 'read',
  Update = 'update',
  Delete = 'delete',
  Export = 'export',
  ManageParticipants = 'manage_participants',
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
  | 'Convivencia'
  | 'Space'
  | 'SpaceReservation'
  | 'Sport'
  | 'SportGroup'
  | 'ChatRoom'
  | 'ChatMessage'
  | 'PendingSubject'
  | 'ClosingGrade'
  | 'Indicator'
  | 'StudentObservation'
  | 'IndicatorEvaluation'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

export { AbilityBuilder, createMongoAbility };
