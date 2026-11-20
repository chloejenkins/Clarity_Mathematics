# The preview site

A web link where you can click through the whole Clarity app as the tutor, a
student or a parent, without signing in. It updates itself every time a pull
request is merged, so you never need Terminal to see the latest version.

- **Made-up data only.** The people (Chloé the tutor, Sam, Maya, Leo, Pat the
  parent, Nina the new visitor), lessons, homework, chats and payments are the
  same demo data as `e2e/scripts/demo.sh`. Pick who you are with the
  **Preview as** button at the top of the page.
- **Completely separate from the live site.** It has its own throwaway database
  inside the preview itself. It can't see or change real families' data, and it
  doesn't use Clerk.
- **Resets itself.** Whenever it updates or wakes from sleep it starts again
  from the same demo data, so feel free to click anything.
- **Hidden from Google.** Pages are marked "don't index" and `robots.txt` blocks
  search engines. Anyone you give the link to can open it, but there is nothing
  private on it.
- **Free.** It runs on Render's free plan, which sleeps after 15 minutes
  without visitors. The first visit after that shows Render's "waking up"
  screen for about two minutes, then the site opens by itself. To keep it
  always awake, change `plan: free` to `plan: starter` in
  `render-preview.yaml` ($7 a month).

How it is built: `render-preview.yaml` (the Render settings),
`preview/Dockerfile` (builds the site with the demo sign-in) and
`preview/start.sh` (starts the database, adds the demo data, opens the site).

## One-time setup (Chloé, about 10 minutes)

1. Go to **https://dashboard.render.com/register** and choose **GitHub** to sign
   up with your GitHub account. If you already have a Render account, just sign in.
2. In Render, click **+ New** (top right), then **Blueprint**.
3. Under **Connect a repository**, click **GitHub** / **Configure account** if
   asked, allow Render to see **Clarity_Mathematics**, then click **Connect**
   next to `chloejenkins/Clarity_Mathematics`.
4. On the next page:
   - **Blueprint Name**: type `Clarity preview`.
   - **Branch**: leave it as `main`.
   - **Blueprint Path**: change `render.yaml` to **`render-preview.yaml`**.
     (This is important: `render.yaml` is the live site, which isn't set up yet.)
   - It should list one service, **clarity-preview**, on the **Free** plan.
     Click **Deploy Blueprint**.
5. Wait for the first build (about 10 minutes). Click **clarity-preview** to
   watch it. When it says **Live**, the link is at the top of the page, under
   the name, for example `https://clarity-preview.onrender.com`.
   Bookmark it.
6. Turn on a preview for every pull request: on the **clarity-preview** page,
   click **Previews** in the left menu, set **Pull Request Previews** to
   **Automatic**, and click **Save**.

That's it. From now on:

- **After a pull request is merged**, the bookmarked link updates by itself
  within about 10 minutes (once the GitHub checks pass). Refresh the page.
- **For a pull request that isn't merged yet**, Render builds a separate copy.
  Its link appears on the pull request on GitHub (under the checks, as a
  Render deployment) and in Render under **Previews**. Each copy goes away when
  the pull request is closed or merged.

## Checking it on your own computer

Anyone with Docker can run exactly what Render runs:

```sh
docker build -f preview/Dockerfile -t clarity-preview .
docker run -p 10000:10000 clarity-preview
# then open http://localhost:10000
```

## Keeping it in step

The demo data comes from `e2e/scripts/seed-demo.ts`, and the people in the
**Preview as** list from `artifacts/tutor-hub/src/testing/demo-switcher.tsx`.
When a new page or kind of data is added, add some demo data there so the
preview shows it.
