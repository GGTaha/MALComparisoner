import asyncio
import sys
import os

# Add backend directory to sys.path to allow imports
sys.path.append(os.path.abspath('backend'))

from adapters.mal import MALAdapter

async def run():
    adapter = MALAdapter()
    try:
        res = await adapter.fetch_user_list('JoltTheBolt')
        print(f"Success! Fetched {len(res.entries)} entries.")
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(run())
