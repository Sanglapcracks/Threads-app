export type ThreadLikedEvent = {
  type: 'thread.liked';
  threadId: number;
  actorUserId: number;
};

export type ThreadRepliedEvent = {
  type: 'thread.replied';
  threadId: number;
  actorUserId: number;
  replyId: number;
};

export type ThreadEvent = ThreadLikedEvent | ThreadRepliedEvent;