import admin from "firebase-admin";
import { existsSync } from "fs";
import path from "path";

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (existsSync(serviceAccountPath)) {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const serviceAccount = require(serviceAccountPath);
	if (!admin.apps.length) {
		admin.initializeApp({
			credential: admin.credential.cert(
				serviceAccount as admin.ServiceAccount,
			),
		});
	}
} else {
	console.warn(
		"[Firebase] serviceAccountKey.json not found — FCM push notifications disabled.",
	);
	console.warn(
		"[Firebase] Place serviceAccountKey.json in src/config/ to enable push notifications.",
	);
}

export default admin;
