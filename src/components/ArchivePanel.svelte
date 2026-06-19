<script lang="ts">
import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { getPostUrlBySlug } from "../utils/url-utils";

export let tags: string[] = [];
export let categories: string[] = [];
export let sortedPosts: Post[] = [];
export let sortedReviews: ReviewItem[] = [];

const params = new URLSearchParams(window.location.search);
tags = params.has("tag") ? params.getAll("tag") : [];
categories = params.has("category") ? params.getAll("category") : [];
const uncategorized = params.get("uncategorized");

interface Post {
	slug: string;
	data: {
		title: string;
		tags: string[];
		category?: string | null;
		published: Date;
	};
}

interface ReviewItem {
	slug: string;
	data: {
		title: string;
		category: "book" | "movie" | "game";
		star: number;
		keys: string[];
		cover: string;
		date: Date;
	};
	href: string;
}

interface TimelineItem {
	date: Date;
	title: string;
	icon?: string;
	info: string;
	href: string;
}

interface Group {
	year: number;
	items: TimelineItem[];
}

let mode: "posts" | "reviews" = "posts";

const categoryMap: Record<string, string> = {
	book: "📖",
	movie: "🎬",
	game: "🎮",
};

const activeTabClass =
	"px-4 py-2 rounded-lg text-sm font-bold transition-all bg-[var(--primary)] text-white shadow-md";
const inactiveTabClass =
	"px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white dark:bg-[var(--card-bg)] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-black/5 dark:border-white/5";

function formatDate(date: Date) {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${month}-${day}`;
}

function formatTag(tagList: string[]) {
	return tagList.map((t) => `#${t}`).join(" ");
}

function renderStars(star: number) {
	const fullStars = Math.floor(star);
	const hasHalfStar = star % 1 !== 0;
	const emptyStars = 5 - Math.ceil(star);
	return (
		"⭐".repeat(fullStars) + (hasHalfStar ? "✨" : "") + "☆".repeat(emptyStars)
	);
}

$: timelineItems = (() => {
	if (mode === "reviews") {
		return sortedReviews.map((review) => ({
			date: review.data.date,
			title: review.data.title,
			icon: categoryMap[review.data.category] ?? review.data.category,
			info: renderStars(review.data.star),
			href: review.href,
		}));
	}

	let filtered: Post[] = sortedPosts;
	if (tags.length > 0) {
		filtered = filtered.filter(
			(post) =>
				Array.isArray(post.data.tags) &&
				post.data.tags.some((tag) => tags.includes(tag)),
		);
	}
	if (categories.length > 0) {
		filtered = filtered.filter(
			(post) => post.data.category && categories.includes(post.data.category),
		);
	}
	if (uncategorized) {
		filtered = filtered.filter((post) => !post.data.category);
	}

	return filtered.map((post) => ({
		date: post.data.published,
		title: post.data.title,
		info: formatTag(post.data.tags),
		href: getPostUrlBySlug(post.slug),
	}));
})();

$: groups = (() => {
	const grouped = timelineItems.reduce(
		(acc, item) => {
			const year = item.date.getFullYear();
			if (!acc[year]) {
				acc[year] = [];
			}
			acc[year].push(item);
			return acc;
		},
		{} as Record<number, TimelineItem[]>,
	);

	return Object.keys(grouped)
		.map((yearStr) => ({
			year: Number.parseInt(yearStr, 10),
			items: grouped[Number.parseInt(yearStr, 10)],
		}))
		.sort((a, b) => b.year - a.year);
})();
</script>

<div class="card-base px-8 py-6">
    <!-- posts / reviews toggle -->
    <div class="flex gap-3 mb-6">
        <button
                type="button"
                on:click={() => (mode = "posts")}
                class={mode === "posts" ? activeTabClass : inactiveTabClass}
        >
            文章
        </button>
        <button
                type="button"
                on:click={() => (mode = "reviews")}
                class={mode === "reviews" ? activeTabClass : inactiveTabClass}
        >
            书影音
        </button>
    </div>

    {#each groups as group}
        <div>
            <div class="flex flex-row w-full items-center h-[3.75rem]">
                <div class="w-[15%] md:w-[10%] transition text-2xl font-bold text-right text-75">
                    {group.year}
                </div>
                <div class="w-[15%] md:w-[10%]">
                    <div
                            class="h-3 w-3 bg-none rounded-full outline outline-[var(--primary)] mx-auto
                  -outline-offset-[2px] z-50 outline-3"
                    ></div>
                </div>
                <div class="w-[70%] md:w-[80%] transition text-left text-50">
                    {group.items.length} {mode === "posts" ? i18n(group.items.length === 1 ? I18nKey.postCount : I18nKey.postsCount) : "条短评"}
                </div>
            </div>

            {#each group.items as item}
                <a
                        href={item.href}
                        aria-label={item.title}
                        class="group btn-plain !block h-10 w-full rounded-lg hover:text-[initial]"
                >
                    <div class="flex flex-row justify-start items-center h-full">
                        <!-- date -->
                        <div class="w-[15%] md:w-[10%] transition text-sm text-right text-50">
                            {formatDate(item.date)}
                        </div>

                        <!-- dot and line -->
                        <div class="w-[15%] md:w-[10%] relative dash-line h-full flex items-center">
                            <div
                                    class="transition-all mx-auto w-1 h-1 rounded group-hover:h-5
                       bg-[oklch(0.5_0.05_var(--hue))] group-hover:bg-[var(--primary)]
                       outline outline-4 z-50
                       outline-[var(--card-bg)]
                       group-hover:outline-[var(--btn-plain-bg-hover)]
                       group-active:outline-[var(--btn-plain-bg-active)]"
                            ></div>
                        </div>

                        <!-- title -->
                        <div
                                class="w-[70%] md:max-w-[65%] md:w-[65%] text-left font-bold
                     group-hover:translate-x-1 transition-all group-hover:text-[var(--primary)]
                     text-75 pr-8 whitespace-nowrap overflow-ellipsis overflow-hidden"
                        >
                            {item.icon ? `${item.icon} ${item.title}` : item.title}
                        </div>

                        <!-- info (tags for posts, stars for reviews) -->
                        <div
                                class="hidden md:block md:w-[15%] text-left text-sm transition
                     whitespace-nowrap overflow-ellipsis overflow-hidden text-30"
                        >
                            {item.info}
                        </div>
                    </div>
                </a>
            {/each}
        </div>
    {/each}
</div>
