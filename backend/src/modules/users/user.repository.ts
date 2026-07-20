import { query } from "../../db/db.js";
import { User, UserRow } from "./user.types.js";

function hydrateUser(row: UserRow): User {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    displayName: row.display_name,
    handle: row.handle,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function repoUpdateUserProfile(params: {
  clerkUserId: string;
  displayName?: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<User> {
  const { clerkUserId, displayName, handle, bio, avatarUrl } = params;

  console.log(clerkUserId, displayName, handle, bio, avatarUrl);

  const setClauses: string[] = [];
  const values: unknown[] = [clerkUserId]; // $1 is always the clerk user id (used in WHERE)
  let idx = 2; // $2, $3

  // ✅ Fixed the undefined check by directly comparing the values (removing the broken typeof)
  if (displayName !== undefined) {
    setClauses.push(`display_name = $${idx++}`); // display_name = $2
    values.push(displayName);
  }

  if (handle !== undefined) {
    setClauses.push(`handle = $${idx++}`); 
    values.push(handle);
  }

  if (bio !== undefined) {
    setClauses.push(`bio = $${idx++}`); 
    values.push(bio);
  }

  if (avatarUrl !== undefined) {
    setClauses.push(`avatar_url = $${idx++}`); 
    values.push(avatarUrl);
  }

  setClauses.push(`updated_at = NOW()`);

  const result = await query<UserRow>(
    `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE clerk_user_id = $1
      RETURNING
        id,
        clerk_user_id,
        display_name,
        handle,
        avatar_url,
        bio,
        created_at,
        updated_at
    `,
    values
  );
  console.log(result);

  if (result.rows.length === 0) {
    throw new Error(`no user found for clerk user id= ${clerkUserId}`);
  }

  return hydrateUser(result.rows[0]);
}