import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminMusicController } from "../../controllers/admin.music.controller";
import { adminMusicValidators } from "../../validators/admin.music.validator";

const router = Router();

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get("/stats", adminMusicController.getStats);

// ── Tracks ─────────────────────────────────────────────────────────────────────
router.post(
	"/tracks",
	validate(adminMusicValidators.createTrack),
	adminMusicController.createTrack,
);
router.get(
	"/tracks",
	validate(adminMusicValidators.listTracks),
	adminMusicController.listTracks,
);
router.get("/tracks/:id", adminMusicController.getTrack);
router.patch(
	"/tracks/:id",
	validate(adminMusicValidators.updateTrack),
	adminMusicController.updateTrack,
);
router.delete("/tracks/:id", adminMusicController.deleteTrack);

// ── Artists ────────────────────────────────────────────────────────────────────
router.post(
	"/artists",
	validate(adminMusicValidators.createArtist),
	adminMusicController.createArtist,
);
router.get(
	"/artists",
	validate(adminMusicValidators.listArtists),
	adminMusicController.listArtists,
);
router.get("/artists/:id", adminMusicController.getArtist);
router.put(
	"/artists/:id",
	validate(adminMusicValidators.updateArtist),
	adminMusicController.updateArtist,
);
router.delete("/artists/:id", adminMusicController.deleteArtist);

// ── Genres ─────────────────────────────────────────────────────────────────────
router.post(
	"/genres",
	validate(adminMusicValidators.createGenre),
	adminMusicController.createGenre,
);
router.get(
	"/genres",
	validate(adminMusicValidators.listGenres),
	adminMusicController.listGenres,
);
router.get("/genres/:id", adminMusicController.getGenre);
router.put(
	"/genres/:id",
	validate(adminMusicValidators.updateGenre),
	adminMusicController.updateGenre,
);
router.delete("/genres/:id", adminMusicController.deleteGenre);

export default router;
