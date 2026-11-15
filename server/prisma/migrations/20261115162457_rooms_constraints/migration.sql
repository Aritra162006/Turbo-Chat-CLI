-- Enforce valid room membership roles
ALTER TABLE "RoomMember"
ADD CONSTRAINT "RoomMember_role_check"
CHECK ("role" IN ('owner', 'member'));

-- Enforce valid room names
ALTER TABLE "Room"
ADD CONSTRAINT "Room_name_check"
CHECK ("name" ~ '^[a-z0-9_-]{1,30}$');
