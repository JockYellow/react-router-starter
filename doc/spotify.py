import spotipy
from spotipy.oauth2 import SpotifyOAuth

# --- 這裡填入你的資訊 ---
CLIENT_ID = 'faa338557e2643799b05abc270cdf875'
CLIENT_SECRET = 'e55bdbfd5c77496aad01981ac259ef65'
REDIRECT_URI = 'http://127.0.0.1:8888/callback' # 記得這裡要跟網頁填的一模一樣

# 設定權限：讀取你關注的藝人
scope = "user-follow-read"

sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=scope
))

def get_followed_artists():
    """抓取關注的藝人"""
    results = sp.current_user_followed_artists(limit=50)
    artists = results['artists']['items']
    return [artist['name'] for artist in artists]

def merge_sort_ranking(artists):
    """使用合併排序進行二選一"""
    if len(artists) <= 1:
        return artists
    mid = len(artists) // 2
    left = merge_sort_ranking(artists[:mid])
    right = merge_sort_ranking(artists[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        print(f"\n【 2選1對決 】")
        print(f"👉 1. {left[i]}")
        print(f"👉 2. {right[j]}")
        choice = input("你比較喜歡哪一個？輸入 1 或 2: ")
        if choice == '2':
            result.append(right[j])
            j += 1
        else:
            result.append(left[i])
            i += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result

# --- 執行程式 ---
try:
    print("正在連線到 Spotify 並抓取你的關注藝人...")
    names = get_followed_artists()
    
    if not names:
        print("你的關注清單是空的喔！快去 Spotify 追蹤幾個歌手吧。")
    else:
        print(f"成功抓取 {len(names)} 位藝人，開始排位賽！")
        final_list = merge_sort_ranking(names)
        
        print("\n" + "★" * 30)
        print("🏆 你的歌手最終排名 🏆")
        for idx, name in enumerate(final_list, 1):
            print(f"第 {idx} 名: {name}")
        print("★" * 30)

except Exception as e:
    print(f"發生錯誤：{e}")