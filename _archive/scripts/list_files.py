import os.path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive.file']
FOLDER_ID = '19MoRJSXHzHuhTzp-pCYc-ahKntZUPb-V'

def main():
    if not os.path.exists('token.json'):
        print("Error: token.json not found. Run create_as_me.py first.")
        return

    creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    service = build('drive', 'v3', credentials=creds)

    print(f"\n--- Contents of Folder: {FOLDER_ID} ---")
    
    # Query to find files inside the specific folder
    query = f"'{FOLDER_ID}' in parents and trashed = false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    items = results.get('files', [])

    if not items:
        print("No files found.")
    else:
        for item in items:
            print(f"  - {item['name']} (ID: {item['id']})")

if __name__ == '__main__':
    main()
