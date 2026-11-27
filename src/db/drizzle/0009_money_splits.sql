CREATE TABLE `splits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`total_amount` real NOT NULL,
	`participants` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
