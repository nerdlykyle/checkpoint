# Checkpoint Discord app

This Firebase Functions package powers a user-installed Discord app. It exposes:

- `/reminder message date time [timezone] [user]` — schedules a personal DM. Central is the default; Eastern, Mountain, and Pacific use daylight-saving-aware IANA time zones.
- `/checkpoint tonight` — posts tonight’s Checkpoint event into the current Discord chat.
- `/checkpoint next` — posts the current Up next queue.

Commands are registered for `USER_INSTALL` and `PRIVATE_CHANNEL`, so they can be invoked in the crew’s existing group DM. Discord does not let a user-installed app wake up later and post arbitrarily into that existing group DM. The command confirmation remains in the group chat, while the scheduled reminder is delivered as a personal DM to the selected user.

## One-time setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications). On **Installation**, enable **User Install** and add the `applications.commands` scope.
2. Copy the Application ID, Public Key, and Bot Token. Never commit those values.
3. Upgrade the Firebase project to Blaze if necessary. Scheduled Functions use Cloud Scheduler.
4. From the repository root, install and authenticate the Firebase CLI, then set secrets:

   ```sh
   firebase functions:secrets:set DISCORD_BOT_TOKEN
   firebase functions:secrets:set DISCORD_PUBLIC_KEY
   ```

5. Deploy the functions and copy the `discordInteractions` URL:

   ```sh
   firebase deploy --only functions
   ```

6. In Discord’s **General Information**, set **Interactions Endpoint URL** to the deployed `discordInteractions` URL.
7. Register the global commands locally:

   ```sh
   cd functions
   DISCORD_APPLICATION_ID="your application id" DISCORD_BOT_TOKEN="your bot token" npm run register
   ```

8. Use the Discord Developer Portal’s install link to install Checkpoint to each user. Each player who wants personal reminders should install it.

Deploy the updated Firestore rules separately with `firebase deploy --only firestore:rules` so shared sessions and activity history can sync.
