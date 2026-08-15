CREATE TABLE `shoppingcart` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`products` text NOT NULL,
	`note` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`location` text
);
