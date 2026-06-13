import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        # We use the local file path
        path = os.path.abspath('Menu/Admin.html')
        await page.goto(f'file://{path}')

        # Wait for some content to load
        await page.wait_for_timeout(2000)

        # Take a full page screenshot
        await page.screenshot(path='admin_panel_ui.png', full_page=True)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
