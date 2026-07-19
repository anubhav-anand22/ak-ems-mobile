CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expenseType` text NOT NULL,
	`subExpenseType` text NOT NULL,
	`amountArr` text NOT NULL,
	`toFrom` text NOT NULL,
	`note` text,
	`tags` text,
	`interestType` text DEFAULT 'None',
	`interestRate` real,
	`interestTime` real,
	`compoundingFrequency` text,
	`location` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
DROP TABLE `users`;