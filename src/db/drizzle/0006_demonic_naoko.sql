CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`targetName` text NOT NULL,
	`targetMoney` real NOT NULL,
	`currentMoney` real DEFAULT 0 NOT NULL,
	`note` text,
	`tags` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
