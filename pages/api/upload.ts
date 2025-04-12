import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';

export default api()
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        // 图片上传功能已被移除
        res.status(403).json({ 
            error: 'IMAGE_UPLOAD_DISABLED',
            message: '图片上传功能已被禁用' 
        });
    });
