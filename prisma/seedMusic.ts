import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface RawTrack {
	trackName: string;
	artists: string;
	albumName: string | null;
	popularity: number | null;
	isExplicit: string;
	durationMs: number | null;
	danceability: number | null;
	energy: number | null;
	key: string | null;
	loudness: number | null;
	speechiness: number | null;
	acousticness: number | null;
	instrumentalness: number | null;
	liveness: number | null;
	valence: number | null;
	tempo: number | null;
	trackGenre: string | null;
	lyrics: string | null;
}

const BATCH_SIZE = 500;

function parseExplicit(value: string): boolean {
	const v = value?.toLowerCase();
	return v === "true" || v === "yes";
}

function parseKey(value: string | null): number | null {
	if (value == null) return null;
	const n = parseInt(value, 10);
	return isNaN(n) ? null : n;
}

function parseNames(value: string): string[] {
	return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseGenres(value: string | null): string[] {
	if (!value) return [];
	return value.split("|").map((s) => s.trim()).filter(Boolean);
}

async function main() {
	console.log("Loading music data...");
	const dataPath = join(__dirname, "../src/data/music.json");
	const rawData: RawTrack[] = JSON.parse(readFileSync(dataPath, "utf-8"));
	console.log(`Loaded ${rawData.length} tracks`);

	// Step 1: Collect unique artists and genres
	const artistNameSet = new Set<string>();
	const genreNameSet = new Set<string>();

	for (const track of rawData) {
		parseNames(track.artists).forEach((name) => artistNameSet.add(name));
		parseGenres(track.trackGenre).forEach((name) => genreNameSet.add(name));
	}

	console.log(`Found ${artistNameSet.size} unique artists`);
	console.log(`Found ${genreNameSet.size} unique genres`);

	// Step 2: Upsert artists in batches
	const artistNames = [...artistNameSet];
	for (let i = 0; i < artistNames.length; i += BATCH_SIZE) {
		await prisma.artist.createMany({
			data: artistNames.slice(i, i + BATCH_SIZE).map((name) => ({ name })),
			skipDuplicates: true,
		});
	}
	console.log("✓ Artists seeded");

	// Step 3: Upsert genres in batches
	const genreNames = [...genreNameSet];
	for (let i = 0; i < genreNames.length; i += BATCH_SIZE) {
		await prisma.genre.createMany({
			data: genreNames.slice(i, i + BATCH_SIZE).map((name) => ({ name })),
			skipDuplicates: true,
		});
	}
	console.log("✓ Genres seeded");

	// Step 4: Build name -> id maps
	const allArtists = await prisma.artist.findMany({ select: { id: true, name: true } });
	const artistMap = new Map(allArtists.map((a) => [a.name, a.id]));

	const allGenres = await prisma.genre.findMany({ select: { id: true, name: true } });
	const genreMap = new Map(allGenres.map((g) => [g.name, g.id]));

	// Step 5: Pre-assign UUIDs and insert tracks in batches
	const trackArtistData: { trackId: string; artistId: string }[] = [];
	const trackGenreData: { trackId: string; genreId: string }[] = [];

	for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
		const batch = rawData.slice(i, i + BATCH_SIZE);

		const batchWithIds = batch.map((t) => ({
			id: randomUUID(),
			trackName: t.trackName,
			albumName: t.albumName || null,
			popularity: t.popularity != null ? Math.round(t.popularity) : null,
			isExplicit: parseExplicit(t.isExplicit),
			durationMs: t.durationMs ?? null,
			danceability: t.danceability ?? null,
			energy: t.energy ?? null,
			key: parseKey(t.key),
			loudness: t.loudness ?? null,
			speechiness: t.speechiness ?? null,
			acousticness: t.acousticness ?? null,
			instrumentalness: t.instrumentalness ?? null,
			liveness: t.liveness ?? null,
			valence: t.valence ?? null,
			tempo: t.tempo ?? null,
			lyrics: t.lyrics || null,
			_raw: t,
		}));

		await prisma.track.createMany({
			data: batchWithIds.map(({ _raw: _, ...trackData }) => trackData),
		});

		// Collect relationship data using pre-assigned IDs
		for (const { id, _raw: t } of batchWithIds) {
			for (const name of parseNames(t.artists)) {
				const artistId = artistMap.get(name);
				if (artistId) trackArtistData.push({ trackId: id, artistId });
			}
			for (const name of parseGenres(t.trackGenre)) {
				const genreId = genreMap.get(name);
				if (genreId) trackGenreData.push({ trackId: id, genreId });
			}
		}

		console.log(`  Tracks: ${Math.min(i + BATCH_SIZE, rawData.length)}/${rawData.length}`);
	}
	console.log("✓ Tracks seeded");

	// Step 6: Insert TrackArtist relationships in batches
	for (let i = 0; i < trackArtistData.length; i += BATCH_SIZE) {
		await prisma.trackArtist.createMany({
			data: trackArtistData.slice(i, i + BATCH_SIZE),
		});
	}
	console.log("✓ Track-Artist links seeded");

	// Step 7: Insert TrackGenre relationships in batches
	for (let i = 0; i < trackGenreData.length; i += BATCH_SIZE) {
		await prisma.trackGenre.createMany({
			data: trackGenreData.slice(i, i + BATCH_SIZE),
		});
	}
	console.log("✓ Track-Genre links seeded");

	const trackCount = await prisma.track.count();
	const artistCount = await prisma.artist.count();
	const genreCount = await prisma.genre.count();
	console.log(`\nMusic seed complete!`);
	console.log(`  Tracks : ${trackCount}`);
	console.log(`  Artists: ${artistCount}`);
	console.log(`  Genres : ${genreCount}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
		await pool.end();
	});
