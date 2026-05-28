import { RouterProvider } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { router } from './config/routes.jsx'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

export const App = () => <RouterProvider router={router} />
