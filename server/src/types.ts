export type ApplicationStatus =
  | 'applied'
  | 'oa'
  | 'interview'
  | 'offer'
  | 'rejected';

export type AuthRequest = {
  user?: {
    id: number;
  };
};
