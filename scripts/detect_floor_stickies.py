import cv2,numpy as np,json,sys,math
BASE='/'.join(__import__('os').path.expanduser('~/mnt/rithmyouthretreat/stickies:8domains').split('/'))
# domain: (photo, crop frac x0,y0,x1,y1, extra flip 180)
SRC={'tec':('IMG_3642',(0,0,1,1),0),'wor':('IMG_3643',(0,0,.93,1),0),'com':('IMG_3644',(0,.1,.75,1),0),'cul':('IMG_3645',(.05,0,1,.95),0),
     'pol':('IMG_3646',(0,0,1,1),0),'phy':('IMG_3647',(0,.12,1,1),180),'rel':('IMG_3648',(0,0,1,1),180),'sch':('IMG_3649',(.08,0,.44,.3),180)}
COL={'pink':((150,179),(60,255),(140,255)),'orange':((5,22),(90,255),(150,255)),'green':((35,75),(70,255),(110,255)),'blue':((88,112),(90,255),(120,255))}
def run(dom):
    name,(a,b,c,d),flip=SRC[dom]
    im=cv2.imread(f'{BASE}/{name}.JPG'); H,W=im.shape[:2]; im=im[int(b*H):int(d*H),int(a*W):int(c*W)]
    sc=1500/max(im.shape[:2]); im=cv2.resize(im,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
    hsv=cv2.cvtColor(cv2.GaussianBlur(im,(5,5),0),cv2.COLOR_BGR2HSV)
    blobs=[]; k=np.ones((5,5),np.uint8)
    for cn,((h0,h1),(s0,s1),(v0,v1)) in COL.items():
        m=cv2.inRange(hsv,(h0,s0,v0),(h1,s1,v1)); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k); m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k,iterations=2)
        cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        for c_ in cs:
            ar=cv2.contourArea(c_)
            if ar>600: blobs.append((cn,c_,ar))
    areas=sorted(a_ for _,_,a_ in blobs)
    # single-note area: the mode-ish value = median of the upper-middle of the small blobs
    med=np.median([a_ for a_ in areas if a_>0.35*np.percentile(areas,60)])
    med=np.median([a_ for a_ in areas if 0.55*med<a_<1.5*med]) if any(0.55*med<a_<1.5*med for a_ in areas) else med
    side=math.sqrt(med); notes=[]
    for cn,c_,ar in blobs:
        if ar<0.3*med: continue
        n=max(1,int(round(ar/med)))
        if n==1:
            (cx,cy),(w,h),ang=cv2.minAreaRect(c_); notes.append((cn,cx,cy,((ang+45)%90)-45))
        else:
            mask=np.zeros(im.shape[:2],np.uint8); cv2.drawContours(mask,[c_],-1,255,-1); pts=np.column_stack(np.where(mask>0))[:, ::-1].astype(np.float32)
            _,lab,cen=cv2.kmeans(pts,n,None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,30,1),4,cv2.KMEANS_PP_CENTERS)
            rs=np.random.RandomState(len(notes))
            for cx,cy in cen: notes.append((cn,float(cx),float(cy),float(rs.uniform(-18,18))))
    # label paper: brightest low-saturation big blob
    pm=cv2.inRange(hsv,(0,0,185),(179,45,255)); pm=cv2.morphologyEx(pm,cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
    cs,_=cv2.findContours(pm,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE); cs=[c_ for c_ in cs if cv2.contourArea(c_)>1.2*med]
    if cs:
        # paper is partly covered; merge blobs near the largest
        mx,my=np.mean([n[1] for n in notes]),np.mean([n[2] for n in notes]); big=min(cs,key=lambda c_: np.hypot(cv2.minAreaRect(c_)[0][0]-mx,cv2.minAreaRect(c_)[0][1]-my)); (px,py),(pw,ph),pang=cv2.minAreaRect(np.vstack([c_ for c_ in cs if np.hypot(*(np.array(cv2.minAreaRect(c_)[0])-np.array(cv2.minAreaRect(big)[0])))<3.2*side]))
        if pw<ph: pang+=90
        pang=((pang+90)%180)-90
    else: px,py,pang=float(np.mean([n[1] for n in notes])),float(np.mean([n[2] for n in notes])),0
    th=-math.radians(pang)+math.radians(flip); co,si=math.cos(th),math.sin(th); out=[]
    for cn,cx,cy,ang in notes:
        dx,dy=(cx-px)/side,(cy-py)/side; out.append({'color':cn,'x':round(dx*co-dy*si,3),'y':round(dx*si+dy*co,3),'rot':round(((ang-pang+45)%90)-45,1)})
    vis=im.copy(); cc={'pink':(180,60,255),'orange':(0,140,255),'green':(60,200,60),'blue':(255,160,0)}
    for (cn,cx,cy,ang) in notes: cv2.circle(vis,(int(cx),int(cy)),10,(255,255,255),-1); cv2.circle(vis,(int(cx),int(cy)),7,cc[cn],-1)
    cv2.circle(vis,(int(px),int(py)),16,(0,0,255),3); cv2.putText(vis,f'{dom} n={len(notes)} ang={pang:.0f}',(10,40),cv2.FONT_HERSHEY_SIMPLEX,1.2,(0,255,255),3)
    vis=cv2.resize(vis,(620,int(vis.shape[0]*620/vis.shape[1])))
    return out,vis
res={};tiles=[]
for dom in SRC:
    o,v=run(dom); res[dom]=o; c=np.full((440,620,3),30,np.uint8); v=v[:440]; c[:v.shape[0]]=v; tiles.append(c)
json.dump(res,open('data/floor-slots.json','w'))
sheet=np.vstack([np.hstack(tiles[i:i+3]+[np.full((440,620,3),30,np.uint8)]*(3-len(tiles[i:i+3]))) for i in range(0,8,3)])
cv2.imwrite(__import__('os').path.expanduser('~/mnt/rithmyouthretreat/Claude outputs/_floor.jpg'),sheet,[cv2.IMWRITE_JPEG_QUALITY,85])
import collections
for d,o in res.items(): print(d,len(o),dict(collections.Counter(n['color'] for n in o)))
