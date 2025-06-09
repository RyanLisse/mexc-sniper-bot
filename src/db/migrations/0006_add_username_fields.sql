-- Add username fields for Better Auth username plugin
ALTER TABLE `user` ADD `username` text;
ALTER TABLE `user` ADD `displayUsername` text;
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);